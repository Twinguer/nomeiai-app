-- ============================================================================
-- MIGRATION: Corrigir permissões para remoção de membros
-- DATA: 2025-02-06
-- OBJETIVO: Permitir que criadores e admins removam membros de grupos
-- ============================================================================

-- Policy para permitir que criadores e admins removam membros (mudar status para 'removed')
DROP POLICY IF EXISTS "Admins can remove members" ON public.study_group_members;

CREATE POLICY "Admins can remove members"
  ON public.study_group_members FOR UPDATE
  USING (
    -- Criador do grupo pode remover membros
    EXISTS (
      SELECT 1 FROM study_groups sg
      WHERE sg.id = study_group_members.group_id
        AND sg.created_by = auth.uid()
    )
    OR
    -- Admin do grupo pode remover membros
    EXISTS (
      SELECT 1 FROM study_group_members sgm2
      WHERE sgm2.group_id = study_group_members.group_id
        AND sgm2.user_id = auth.uid()
        AND sgm2.role IN ('admin', 'coach')
        AND sgm2.status = 'active'
    )
  )
  WITH CHECK (
    -- Pode mudar status para 'removed' ou 'left'
    NEW.status IN ('removed', 'left')
    AND NEW.user_id = OLD.user_id
    AND NEW.group_id = OLD.group_id
  );

COMMENT ON POLICY "Admins can remove members" ON public.study_group_members IS 
  'Permite que criadores e admins do grupo removam membros, mudando o status para "removed".';



