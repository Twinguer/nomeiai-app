-- Migration: Adicionar suporte a planos coach nos vouchers
-- Altera o campo plan de enum para TEXT para suportar planos coach
-- Mantém compatibilidade com valores existentes (free, pro)

-- ✅ PRIMEIRO: Dropar a view que depende da coluna plan
DROP VIEW IF EXISTS vouchers_applied_with_users;

-- Remover constraint antiga se existir
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'vouchers_plan_check'
  ) THEN
    ALTER TABLE vouchers DROP CONSTRAINT vouchers_plan_check;
  END IF;
END $$;

-- Alterar o tipo da coluna plan de subscription_plan para TEXT
-- Isso permite armazenar valores além do enum (coach_starter, coach_professional, coach_enterprise)
ALTER TABLE vouchers 
ALTER COLUMN plan TYPE TEXT USING plan::TEXT;

-- Adicionar constraint para validar os valores permitidos
-- Mantém free e pro para compatibilidade, adiciona os 3 planos coach
ALTER TABLE vouchers
ADD CONSTRAINT vouchers_plan_check 
CHECK (plan IN ('free', 'pro', 'coach_starter', 'coach_professional', 'coach_enterprise'));

-- Comentário para documentação
COMMENT ON COLUMN vouchers.plan IS 'Plano do voucher: free, pro, coach_starter, coach_professional ou coach_enterprise';

-- Atualizar função apply_voucher para suportar planos coach
-- EXATAMENTE igual ao Pro: mesma estrutura, mesma lógica, mesma validação
CREATE OR REPLACE FUNCTION apply_voucher(voucher_code_param TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_voucher RECORD;
  v_user_id UUID;
  v_new_expiry TIMESTAMP WITH TIME ZONE;
  v_existing_user_id UUID;
  v_plan_type TEXT;
  v_max_students INTEGER;
  v_price DECIMAL(10,2);
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuário não autenticado');
  END IF;

  -- Get voucher (EXATAMENTE como no Pro)
  -- Buscar voucher e verificar limite depois (mais seguro que verificar no WHERE)
  SELECT * INTO v_voucher
  FROM vouchers
  WHERE code = voucher_code_param
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > NOW())
    AND voucher_type = 'subscription';
  
  IF v_voucher IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Voucher inválido, expirado ou não é um voucher de assinatura');
  END IF;
  
  -- Verificar limite de usos (uses_count ou current_uses)
  IF (v_voucher.uses_count IS NOT NULL AND v_voucher.uses_count >= v_voucher.max_uses) OR
     (v_voucher.current_uses IS NOT NULL AND v_voucher.current_uses >= v_voucher.max_uses) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Voucher atingiu o limite de usos');
  END IF;
  
  -- Calculate new expiry (igual ao Pro)
  v_new_expiry := NOW() + (v_voucher.duration_months || ' months')::INTERVAL;

  -- Se for plano coach, aplicar em coach_subscriptions (EXATAMENTE como Pro em user_subscriptions)
  IF v_voucher.plan LIKE 'coach_%' THEN
    -- Mapear coach_starter -> starter, coach_professional -> professional, coach_enterprise -> enterprise
    v_plan_type := CASE 
      WHEN v_voucher.plan = 'coach_starter' THEN 'starter'
      WHEN v_voucher.plan = 'coach_professional' THEN 'professional'
      WHEN v_voucher.plan = 'coach_enterprise' THEN 'enterprise'
      ELSE NULL
    END;
    
    -- Configurar plano coach
    CASE v_plan_type
      WHEN 'starter' THEN v_max_students := 5; v_price := 49.90;
      WHEN 'professional' THEN v_max_students := 10; v_price := 89.90;
      WHEN 'enterprise' THEN v_max_students := 25; v_price := 149.90;
      ELSE RETURN jsonb_build_object('success', false, 'error', 'Plano coach inválido');
    END CASE;
    
    -- Verificar se o voucher já foi usado por outro usuário (EXATAMENTE como no Pro)
    SELECT coach_id INTO v_existing_user_id
    FROM coach_subscriptions
    WHERE voucher_code = voucher_code_param
      AND coach_id != v_user_id
    LIMIT 1;
    
    IF v_existing_user_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'success', false, 
        'error', 'Este voucher já foi utilizado por outro usuário. Cada voucher só pode ser usado uma vez.'
      );
    END IF;
    
    -- Verificar se o usuário atual já usou este voucher (EXATAMENTE como no Pro)
    SELECT coach_id INTO v_existing_user_id
    FROM coach_subscriptions
    WHERE voucher_code = voucher_code_param
      AND coach_id = v_user_id
    LIMIT 1;
    
    IF v_existing_user_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'success', false, 
        'error', 'Você já utilizou este voucher anteriormente.'
      );
    END IF;
    
    -- Update or insert subscription (EXATAMENTE como no Pro)
    INSERT INTO coach_subscriptions (coach_id, plan_type, status, max_students, price, expires_at, voucher_code)
    VALUES (v_user_id, v_plan_type, 'active', v_max_students, v_price, v_new_expiry, voucher_code_param)
    ON CONFLICT (coach_id) 
    DO UPDATE SET
      plan_type = v_plan_type,
      status = 'active',
      max_students = v_max_students,
      price = v_price,
      expires_at = v_new_expiry,
      voucher_code = voucher_code_param,
      updated_at = NOW();
  ELSE
    -- Lógica Pro/Free (original - EXATAMENTE como está)
    -- Verificar se o voucher já foi usado por outro usuário
    SELECT user_id INTO v_existing_user_id
    FROM user_subscriptions
    WHERE voucher_code = voucher_code_param
      AND user_id != v_user_id
    LIMIT 1;
    
    IF v_existing_user_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'success', false, 
        'error', 'Este voucher já foi utilizado por outro usuário. Cada voucher só pode ser usado uma vez.'
      );
    END IF;
    
    -- Verificar se o usuário atual já usou este voucher
    SELECT user_id INTO v_existing_user_id
    FROM user_subscriptions
    WHERE voucher_code = voucher_code_param
      AND user_id = v_user_id
    LIMIT 1;
    
    IF v_existing_user_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'success', false, 
        'error', 'Você já utilizou este voucher anteriormente.'
      );
    END IF;
    
    -- Update or insert subscription
    IF v_voucher.plan NOT IN ('free', 'pro') THEN
      RETURN jsonb_build_object('success', false, 'error', 'Plano inválido para assinatura de usuário');
    END IF;
    
    INSERT INTO user_subscriptions (user_id, plan, expires_at, voucher_code)
    VALUES (v_user_id, v_voucher.plan::subscription_plan, v_new_expiry, voucher_code_param)
    ON CONFLICT (user_id) 
    DO UPDATE SET
      plan = v_voucher.plan::subscription_plan,
      expires_at = v_new_expiry,
      voucher_code = voucher_code_param,
      is_active = true,
      updated_at = NOW();
  END IF;

  -- Increment voucher usage (igual ao Pro)
  -- Atualizar ambas as colunas se existirem (uma será NULL e não será atualizada)
  UPDATE vouchers
  SET 
    uses_count = CASE WHEN uses_count IS NOT NULL THEN uses_count + 1 ELSE NULL END,
    current_uses = CASE WHEN current_uses IS NOT NULL THEN current_uses + 1 ELSE NULL END,
    updated_at = NOW()
  WHERE code = voucher_code_param;

  RETURN jsonb_build_object(
    'success', true, 
    'plan', v_voucher.plan,
    'expires_at', v_new_expiry
  );
END;
$$;

-- Adicionar coluna voucher_code na tabela coach_subscriptions se não existir
-- Isso permite rastrear qual voucher foi usado para criar/atualizar a assinatura
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'coach_subscriptions' 
    AND column_name = 'voucher_code'
  ) THEN
    ALTER TABLE coach_subscriptions 
    ADD COLUMN voucher_code TEXT;
    
    -- Adicionar índice para melhorar performance
    CREATE INDEX IF NOT EXISTS idx_coach_subscriptions_voucher_code 
    ON coach_subscriptions(voucher_code);
    
    -- Comentário
    COMMENT ON COLUMN coach_subscriptions.voucher_code IS 'Código do voucher usado para criar/atualizar esta assinatura coach';
  END IF;
END $$;

-- Atualizar view vouchers_applied_with_users para incluir vouchers de coach
-- Usando UNION para combinar vouchers de user_subscriptions e coach_subscriptions
CREATE OR REPLACE VIEW vouchers_applied_with_users AS
-- Vouchers aplicados em user_subscriptions (planos free/pro)
SELECT 
  v.code as voucher_code,
  v.voucher_type,
  v.plan as voucher_plan,
  v.duration_months,
  v.description as voucher_description,
  v.created_at as voucher_created_at,
  v.expires_at as voucher_expires_at,
  us.user_id,
  us.plan as user_plan,
  us.expires_at as subscription_expires_at,
  us.is_active as subscription_active,
  us.created_at as applied_at,
  up.name as user_name,
  up.email as user_email,
  au.email as auth_email,
  NULL::TEXT as coach_plan_type,
  NULL::INTEGER as coach_max_students,
  NULL::DECIMAL as coach_price,
  NULL::TEXT as coach_status
FROM vouchers v
LEFT JOIN user_subscriptions us ON v.code = us.voucher_code
LEFT JOIN users_profiles up ON us.user_id = up.id
LEFT JOIN auth.users au ON us.user_id = au.id
WHERE v.voucher_type = 'subscription'
  AND v.plan IN ('free', 'pro')

UNION ALL

-- Vouchers aplicados em coach_subscriptions (planos coach)
SELECT 
  v.code as voucher_code,
  v.voucher_type,
  v.plan as voucher_plan,
  v.duration_months,
  v.description as voucher_description,
  v.created_at as voucher_created_at,
  v.expires_at as voucher_expires_at,
  cs.coach_id as user_id,
  NULL::subscription_plan as user_plan,
  cs.expires_at as subscription_expires_at,
  (cs.status = 'active')::BOOLEAN as subscription_active,
  cs.created_at as applied_at,
  up.name as user_name,
  up.email as user_email,
  au.email as auth_email,
  cs.plan_type as coach_plan_type,
  cs.max_students as coach_max_students,
  cs.price as coach_price,
  cs.status as coach_status
FROM vouchers v
LEFT JOIN coach_subscriptions cs ON v.code = cs.voucher_code
LEFT JOIN users_profiles up ON cs.coach_id = up.id
LEFT JOIN auth.users au ON cs.coach_id = au.id
WHERE v.voucher_type = 'subscription'
  AND v.plan LIKE 'coach_%';

-- Atualizar comentário da view
COMMENT ON VIEW vouchers_applied_with_users IS 'View que mostra vouchers de subscription aplicados com informações dos usuários (planos free/pro) e coaches (planos coach) que os utilizaram';

