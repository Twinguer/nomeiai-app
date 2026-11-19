-- ============================================
-- Migration: Corrigir RLS para coach_invitations_history
-- Data: 2025-02-02
-- Objetivo: Adicionar políticas UPDATE e DELETE para coaches
-- ============================================

-- Remover políticas antigas se existirem
DROP POLICY IF EXISTS "Coaches can update own invitations" ON coach_invitations_history;
DROP POLICY IF EXISTS "Students can update invitations for them" ON coach_invitations_history;
DROP POLICY IF EXISTS "Coaches can delete own pending invitations" ON coach_invitations_history;

-- Política para UPDATE: Coaches podem atualizar seus próprios convites
CREATE POLICY "Coaches can update own invitations"
  ON coach_invitations_history FOR UPDATE
  USING (auth.uid() = coach_id)
  WITH CHECK (auth.uid() = coach_id);

-- Política para UPDATE: Alunos podem atualizar convites destinados a eles (rejeitar)
CREATE POLICY "Students can update invitations for them"
  ON coach_invitations_history FOR UPDATE
  USING (
    auth.uid() = student_id 
    OR student_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  )
  WITH CHECK (
    auth.uid() = student_id 
    OR student_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- Política para DELETE: Coaches podem deletar seus próprios convites (se ainda pendentes)
CREATE POLICY "Coaches can delete own pending invitations"
  ON coach_invitations_history FOR DELETE
  USING (
    auth.uid() = coach_id 
    AND status = 'pending'
  );

-- Comentários
COMMENT ON POLICY "Coaches can update own invitations" ON coach_invitations_history IS 
  'Permite que coaches atualizem status de seus convites (cancelar, etc)';
COMMENT ON POLICY "Students can update invitations for them" ON coach_invitations_history IS 
  'Permite que alunos atualizem status de convites destinados a eles (aceitar/rejeitar)';
COMMENT ON POLICY "Coaches can delete own pending invitations" ON coach_invitations_history IS 
  'Permite que coaches deletem convites pendentes';

