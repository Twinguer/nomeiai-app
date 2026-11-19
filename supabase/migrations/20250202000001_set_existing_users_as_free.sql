-- Migration: Definir todos os usuários existentes como Free
-- Descrição: Cria subscriptions "free" para todos os usuários que não têm subscription
-- Impacto: Adiciona registros em user_subscriptions para usuários existentes
-- Data: 2025-02-02

-- Criar subscriptions "free" para todos os usuários que não têm subscription
INSERT INTO user_subscriptions (user_id, plan, is_active, started_at)
SELECT 
  id as user_id,
  'free'::subscription_plan as plan,
  true as is_active,
  NOW() as started_at
FROM auth.users
WHERE id NOT IN (
  SELECT user_id FROM user_subscriptions WHERE user_id IS NOT NULL
)
ON CONFLICT (user_id) DO NOTHING;

