-- Migration: Forçar TODOS os usuários para Free
-- Descrição: Migration simples e direta - força todos para Free, exceto os que têm expires_at válido
-- Esta migration corrige o problema de usuários com acesso Pro sem pagamento
-- Data: 2025-02-02

-- 1. Garantir que todos os usuários tenham subscription Free
-- Criar subscription Free para usuários sem subscription
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

-- 2. Forçar para Free todos os usuários Pro que:
--    - Não têm expires_at OU
--    - Têm expires_at no passado (expirado) OU  
--    - Têm expires_at NULL mas não têm pagamento aprovado

-- Primeiro, vamos marcar todos os Pro sem expires_at válido para Free
UPDATE user_subscriptions
SET 
  plan = 'free'::subscription_plan,
  is_active = true,
  expires_at = NULL,
  voucher_code = NULL,
  updated_at = NOW()
WHERE plan = 'pro'
  AND (
    -- Sem expires_at
    expires_at IS NULL
    OR
    -- Expires_at no passado (expirado)
    expires_at <= NOW()
    OR
    -- expires_at muito antigo (mais de 2 anos, provavelmente erro)
    expires_at < NOW() - INTERVAL '2 years'
  );

-- 3. Garantir que todas as subscriptions Free estejam ativas
UPDATE user_subscriptions
SET 
  is_active = true,
  updated_at = NOW()
WHERE plan = 'free'
  AND is_active = false;

-- 4. Resultado final: apenas usuários com Pro E expires_at válido no futuro mantêm Pro
-- Todos os outros ficam como Free

