-- ============================================================================
-- MIGRATION: Permitir que usuários Free vejam grupos públicos (mas não o conteúdo)
-- DATA: 2025-11-28
-- OBJETIVO: 
--   - Usuários Free podem ver cards de grupos públicos
--   - Apenas Pro/Coach podem acessar conteúdo (posts, membros)
--   - Ao clicar, usuários Free são redirecionados para página de planos
-- ============================================================================

-- Remover TODAS as policies antigas que podem bloquear Free users
DROP POLICY IF EXISTS "only_pro_or_coach_can_view_groups" ON public.study_groups;
DROP POLICY IF EXISTS "only_pro_can_view_groups" ON public.study_groups;
DROP POLICY IF EXISTS "everyone_can_view_public_groups" ON public.study_groups;
DROP POLICY IF EXISTS "Public groups are viewable by everyone" ON public.study_groups;
DROP POLICY IF EXISTS "Members can view private groups" ON public.study_groups;

-- Nova policy: Todos podem ver grupos públicos, mas apenas Pro/Coach podem ver conteúdo
CREATE POLICY "everyone_can_view_public_groups"
  ON public.study_groups FOR SELECT
  USING (
    -- Todos (incluindo não autenticados) podem ver grupos públicos (para exibir cards)
    -- Isso permite que usuários free vejam os cards, mas não o conteúdo completo
    (privacy_level = 'public' AND archived = false)
    OR
    -- Se autenticado, Pro pode ver todos os grupos
    (auth.uid() IS NOT NULL AND public.is_user_pro(auth.uid()))
    OR
    -- Se autenticado, Coach pode ver todos os grupos
    (auth.uid() IS NOT NULL AND public.is_user_coach(auth.uid()))
    OR
    -- Se autenticado, Admin pode ver todos os grupos
    (auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'admin'::app_role))
    OR
    -- Se autenticado, membros podem ver seus grupos privados
    (auth.uid() IS NOT NULL AND EXISTS (
      SELECT 1 FROM study_group_members sgm
      WHERE sgm.group_id = study_groups.id
        AND sgm.user_id = auth.uid()
        AND sgm.status = 'active'
    ))
  );

COMMENT ON POLICY "everyone_can_view_public_groups" ON public.study_groups IS 
  'Todos podem visualizar grupos públicos (para exibir cards). Apenas Pro/Coach podem acessar conteúdo completo (posts, membros). Usuários Free são redirecionados para página de planos ao clicar.';

