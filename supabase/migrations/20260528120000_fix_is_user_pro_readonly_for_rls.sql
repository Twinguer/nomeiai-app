-- ============================================================================
-- FIX: GET /rest/v1/study_groups retornava 405 em usuários autenticados
-- CAUSA: is_user_pro() fazia UPDATE dentro de policies RLS; GETs do PostgREST
--        rodam em réplica read-only (25006 → HTTP 405).
-- SOLUÇÃO: is_user_pro somente leitura (STABLE); helpers SECURITY DEFINER
--          para evitar recursão RLS study_groups ↔ study_group_members.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_user_pro(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_subscriptions
    WHERE user_id = p_user_id
      AND is_active = true
      AND plan = 'pro'::subscription_plan
      AND (expires_at IS NULL OR expires_at > NOW())
  );
$$;

COMMENT ON FUNCTION public.is_user_pro(UUID) IS
  'Pro válido (somente leitura): plan=pro, is_active e expires_at no futuro. Não escreve — seguro em RLS/GET. Use deactivate_expired_subscriptions() para limpar expirados.';

-- Helpers SECURITY DEFINER: evitam recursão infinita entre policies
CREATE OR REPLACE FUNCTION public.is_active_study_group_member(p_group_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.study_group_members
    WHERE group_id = p_group_id
      AND user_id = p_user_id
      AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_study_group_creator(p_group_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.study_groups
    WHERE id = p_group_id
      AND created_by = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_study_group_admin(p_group_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.study_group_members
    WHERE group_id = p_group_id
      AND user_id = p_user_id
      AND role IN ('admin', 'coach')
      AND status = 'active'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_active_study_group_member(UUID, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_study_group_creator(UUID, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_study_group_admin(UUID, UUID) TO anon, authenticated;

-- study_groups
DROP POLICY IF EXISTS "pro_coach_can_view_all_groups" ON public.study_groups;
DROP POLICY IF EXISTS "everyone_can_view_public_groups" ON public.study_groups;

CREATE POLICY "everyone_can_view_public_groups"
  ON public.study_groups FOR SELECT
  USING (
    (privacy_level = 'public' AND archived = false)
    OR (auth.uid() IS NOT NULL AND public.is_user_pro(auth.uid()))
    OR (auth.uid() IS NOT NULL AND public.is_user_coach(auth.uid()))
    OR (auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'admin'::app_role))
    OR (auth.uid() IS NOT NULL AND public.is_active_study_group_member(id, auth.uid()))
  );

COMMENT ON POLICY "everyone_can_view_public_groups" ON public.study_groups IS
  'Cards públicos para todos; Pro/Coach/admin/membros veem grupos adicionais. is_user_pro read-only.';

-- study_group_members
DROP POLICY IF EXISTS "only_pro_can_view_group_members" ON public.study_group_members;
DROP POLICY IF EXISTS "pro_coach_can_view_group_members" ON public.study_group_members;

CREATE POLICY "pro_coach_can_view_group_members"
  ON public.study_group_members FOR SELECT
  USING (
    public.is_user_pro(auth.uid())
    OR public.is_user_coach(auth.uid())
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_study_group_creator(group_id, auth.uid())
    OR public.is_study_group_admin(group_id, auth.uid())
  );

COMMENT ON POLICY "pro_coach_can_view_group_members" ON public.study_group_members IS
  'Pro/Coach/admin/criador/admin do grupo podem ver membros. Helpers SECURITY DEFINER evitam recursão.';

NOTIFY pgrst, 'reload schema';
