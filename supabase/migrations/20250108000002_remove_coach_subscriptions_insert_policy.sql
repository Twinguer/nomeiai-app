-- ============================================================================
-- MIGRATION: Remover política RLS de INSERT em coach_subscriptions
-- DATA: 2025-01-08
-- OBJETIVO: Impedir criação direta de assinaturas Coach - apenas via Stripe
-- ============================================================================

-- Remover política que permite INSERT direto
DROP POLICY IF EXISTS "Coaches can insert own subscription" ON coach_subscriptions;

-- Comentário explicativo
COMMENT ON TABLE coach_subscriptions IS 
  'Assinaturas do Modo Coach. Devem ser criadas APENAS via Stripe (webhook ou verify-stripe-subscription). Não é permitido INSERT direto via frontend.';

