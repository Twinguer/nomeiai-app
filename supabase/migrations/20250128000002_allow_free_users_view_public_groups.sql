-- ============================================================================
-- MIGRATION: Permitir que usuários Free vejam grupos públicos (mas não o conteúdo)
-- DATA: 2025-01-28
-- OBJETIVO: 
--   - Usuários Free podem ver cards de grupos públicos
--   - Apenas Pro/Coach podem acessar conteúdo (posts, membros)
--   - Ao clicar, usuários Free são redirecionados para página de planos
-- ============================================================================

-- Remover policy antiga que bloqueia Free users
DROP POLICY IF EXISTS "only_pro_or_coach_can_view_groups" ON public.study_groups;

-- Nova policy: Todos podem ver grupos públicos, mas apenas Pro/Coach podem ver conteúdo
CREATE POLICY "everyone_can_view_public_groups"
  ON public.study_groups FOR SELECT
  USING (
    -- Todos podem ver grupos públicos (para exibir cards)
    privacy_level = 'public'
    OR
    -- Pro pode ver todos os grupos
    public.is_user_pro(auth.uid())
    OR
    -- Coach pode ver todos os grupos
    public.is_user_coach(auth.uid())
    OR
    -- Admin pode ver todos os grupos
    public.has_role(auth.uid(), 'admin'::app_role)
    OR
    -- Membros podem ver seus grupos privados
    EXISTS (
      SELECT 1 FROM study_group_members sgm
      WHERE sgm.group_id = study_groups.id
        AND sgm.user_id = auth.uid()
        AND sgm.status = 'active'
    )
  );

COMMENT ON POLICY "everyone_can_view_public_groups" ON public.study_groups IS 
  'Todos podem visualizar grupos públicos (para exibir cards). Apenas Pro/Coach podem acessar conteúdo completo (posts, membros).';

