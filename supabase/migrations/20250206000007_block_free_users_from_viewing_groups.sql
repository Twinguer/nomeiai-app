-- ============================================================================
-- MIGRATION: Bloquear usuários Free de visualizar grupos
-- DATA: 2025-02-06
-- OBJETIVO: Apenas Pro ou Coach podem visualizar grupos de estudos
-- ============================================================================

-- Remover policy antiga que permite qualquer pessoa ver grupos públicos
DROP POLICY IF EXISTS "Public groups are viewable by everyone" ON public.study_groups;
DROP POLICY IF EXISTS "Members can view private groups" ON public.study_groups;

-- Nova policy: Apenas Pro ou Coach podem visualizar grupos
CREATE POLICY "only_pro_or_coach_can_view_groups"
  ON public.study_groups FOR SELECT
  USING (
    -- Pro pode ver todos os grupos
    public.is_user_pro(auth.uid())
    OR
    -- Coach pode ver todos os grupos
    public.is_user_coach(auth.uid())
    OR
    -- Admin pode ver todos os grupos
    public.has_role(auth.uid(), 'admin'::app_role)
  );

-- Atualizar policy de membros: Apenas Pro ou Coach podem ver membros
DROP POLICY IF EXISTS "Public groups members are viewable" ON public.study_group_members;
DROP POLICY IF EXISTS "Group members can view members" ON public.study_group_members;

-- Nova policy: Apenas Pro ou Coach podem ver membros de grupos
-- Mas criadores e admins do grupo também podem ver (para gerenciar o grupo)
CREATE POLICY "only_pro_or_coach_can_view_group_members"
  ON public.study_group_members FOR SELECT
  USING (
    -- Pro pode ver membros
    public.is_user_pro(auth.uid())
    OR
    -- Coach pode ver membros
    public.is_user_coach(auth.uid())
    OR
    -- Admin pode ver membros
    public.has_role(auth.uid(), 'admin'::app_role)
    OR
    -- Criador do grupo pode ver membros (para gerenciar)
    EXISTS (
      SELECT 1 FROM study_groups sg
      WHERE sg.id = study_group_members.group_id
        AND sg.created_by = auth.uid()
    )
    OR
    -- Admin do grupo pode ver membros
    EXISTS (
      SELECT 1 FROM study_group_members sgm2
      WHERE sgm2.group_id = study_group_members.group_id
        AND sgm2.user_id = auth.uid()
        AND sgm2.role IN ('admin', 'coach')
        AND sgm2.status = 'active'
    )
  );

-- Atualizar função get_group_feed para validar plano
CREATE OR REPLACE FUNCTION get_group_feed(
  p_group_id UUID,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_posts JSONB;
  v_user_plan subscription_plan;
  v_is_coach BOOLEAN;
BEGIN
  -- VALIDAÇÃO: Verificar se usuário é Pro ou Coach
  IF auth.uid() IS NOT NULL THEN
    v_user_plan := public.get_user_subscription_plan(auth.uid());
    IF v_user_plan IS NULL THEN
      v_user_plan := 'free'::subscription_plan;
    END IF;
    
    v_is_coach := public.is_user_coach(auth.uid());
    
    -- Free não pode ver posts de grupos
    IF v_user_plan = 'free' AND NOT v_is_coach THEN
      RETURN jsonb_build_object(
        'error', 'Grupos de estudos estão disponíveis apenas no plano Pro ou Modo Coach.',
        'requires_upgrade', true
      );
    END IF;
  ELSE
    -- Usuário não autenticado não pode ver posts
    RETURN jsonb_build_object(
      'error', 'Autenticação necessária para visualizar grupos.'
    );
  END IF;

  -- Buscar posts (código original)
  SELECT jsonb_agg(post ORDER BY 
    CASE WHEN (post->>'is_pinned')::boolean THEN 0 ELSE 1 END,
    (post->>'created_at')::timestamp DESC
  )
  INTO v_posts
  FROM (
    SELECT value as post
    FROM study_groups,
    jsonb_array_elements(posts_data) as value
    WHERE study_groups.id = p_group_id
      AND (value->>'is_deleted')::boolean = false
      AND (value->>'expires_at')::timestamp > NOW()
    ORDER BY 
      CASE WHEN (value->>'is_pinned')::boolean THEN 0 ELSE 1 END,
      (value->>'created_at')::timestamp DESC
    LIMIT p_limit
    OFFSET p_offset
  ) filtered_posts;
  
  RETURN COALESCE(v_posts, '[]'::jsonb);
END;
$$;

COMMENT ON POLICY "only_pro_or_coach_can_view_groups" ON public.study_groups IS 
  'Apenas usuários Pro ou Coach podem visualizar grupos de estudos. Usuários Free não podem acessar grupos.';

COMMENT ON POLICY "only_pro_or_coach_can_view_group_members" ON public.study_group_members IS 
  'Apenas usuários Pro ou Coach podem visualizar membros de grupos. Usuários Free não podem ver membros.';

