-- ============================================
-- Fix: Prevenir convites duplicados na tabela coach_invitations_history
-- ============================================

-- 1. Criar índice UNIQUE parcial para prevenir múltiplos convites pendentes
-- para o mesmo aluno pelo mesmo coach
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_pending_invitation 
ON coach_invitations_history (coach_id, student_email) 
WHERE status = 'pending';

-- 2. Adicionar comentário explicativo
COMMENT ON INDEX idx_unique_pending_invitation IS 
  'Previne múltiplos convites pendentes para o mesmo aluno pelo mesmo coach';

-- 3. Limpar convites pendentes duplicados (manter apenas o mais recente)
-- Esta query remove registros duplicados mantendo apenas o mais recente
WITH duplicate_invitations AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY coach_id, student_email 
      ORDER BY invited_at DESC
    ) as row_num
  FROM coach_invitations_history
  WHERE status = 'pending'
)
DELETE FROM coach_invitations_history
WHERE id IN (
  SELECT id FROM duplicate_invitations WHERE row_num > 1
);

-- 4. Atualizar constraint da tabela (se necessário)
-- Não é necessário para este caso, mas documentamos o comportamento esperado
COMMENT ON TABLE coach_invitations_history IS 
  'Histórico de convites do coach. Apenas 1 convite pendente por aluno permitido';

