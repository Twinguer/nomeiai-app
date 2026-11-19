-- Migration: Forçar TODOS os usuários para Free, exceto Ricardo Lima
-- Descrição: Migration agressiva que força todos os usuários para Free
-- Exceção: Ricardo Lima mantém seu plano atual (se tiver Pro válido)
-- Data: 2025-02-02

-- 1. Garantir que todos os usuários tenham subscription Free
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

-- 2. Identificar Ricardo Lima (buscar de várias formas)
-- Busca por email contendo "ricardo" e "lima" OU nome no perfil
WITH ricardo_user AS (
  SELECT DISTINCT u.id as user_id
  FROM auth.users u
  LEFT JOIN users_profiles up ON u.id = up.id
  WHERE (
    -- Email contém "ricardo" e "lima"
    (LOWER(u.email) LIKE '%ricardo%' AND LOWER(u.email) LIKE '%lima%')
    OR
    -- Nome no perfil contém "ricardo" e "lima"
    (LOWER(COALESCE(up.name, '')) LIKE '%ricardo%' AND LOWER(COALESCE(up.name, '')) LIKE '%lima%')
    OR
    -- Metadata contém "ricardo" e "lima"
    (LOWER(COALESCE(u.raw_user_meta_data->>'name', '')) LIKE '%ricardo%' 
     AND LOWER(COALESCE(u.raw_user_meta_data->>'name', '')) LIKE '%lima%')
    OR
    (LOWER(COALESCE(u.raw_user_meta_data->>'full_name', '')) LIKE '%ricardo%' 
     AND LOWER(COALESCE(u.raw_user_meta_data->>'full_name', '')) LIKE '%lima%')
  )
  LIMIT 1
)
-- 3. FORÇAR TODOS os usuários Pro para Free, EXCETO Ricardo Lima
UPDATE user_subscriptions us
SET 
  plan = 'free'::subscription_plan,
  is_active = true,
  expires_at = NULL,
  voucher_code = NULL,
  updated_at = NOW()
WHERE us.plan = 'pro'
  AND NOT EXISTS (
    SELECT 1 FROM ricardo_user ru WHERE ru.user_id = us.user_id
  );

-- 4. Garantir que todas as subscriptions Free estejam ativas
UPDATE user_subscriptions
SET 
  is_active = true,
  updated_at = NOW()
WHERE plan = 'free'
  AND is_active = false;

-- 5. Verificação: Ver quantos usuários ficaram em cada plano
-- (Pode ser executado separadamente para verificação)
-- SELECT 
--   COUNT(*) FILTER (WHERE plan = 'pro') as pro_users,
--   COUNT(*) FILTER (WHERE plan = 'free') as free_users,
--   COUNT(*) as total_users
-- FROM user_subscriptions;

