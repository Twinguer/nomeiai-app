-- ============================================================================
-- MIGRATION: Adicionar política RLS para INSERT em coach_subscriptions
-- DATA: 2025-01-08
-- OBJETIVO: Permitir que usuários criem suas próprias assinaturas Coach
-- ============================================================================

-- Adicionar política para INSERT (usuários podem criar sua própria assinatura)
CREATE POLICY "Coaches can insert own subscription"
  ON coach_subscriptions FOR INSERT
  WITH CHECK (auth.uid() = coach_id);

-- Comentário
COMMENT ON POLICY "Coaches can insert own subscription" ON coach_subscriptions IS 
  'Permite que usuários criem suas próprias assinaturas Coach. Qualquer usuário pode criar assinatura Coach (Free pode ir direto para Coach).';

