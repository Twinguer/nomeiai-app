-- ============================================================================
-- MIGRATION: Corrigir função apply_voucher para usar uses_count
-- DATA: 2025-01-20
-- OBJETIVO: Corrigir erro "record v_voucher has no field current_uses"
--           A coluna foi renomeada de current_uses para uses_count na migração
--           20251109211545_536d4416-7376-4741-9ebc-e1a78e353d46.sql
--           A migração 20250202000005_enforce_single_user_per_voucher.sql
--           sobrescreveu a função e ainda usa current_uses, causando o erro.
-- ============================================================================

-- Atualizar função apply_voucher para usar uses_count em vez de current_uses
-- Esta versão combina a lógica correta da migração 20250131000000 (que verifica
-- ambos os campos para compatibilidade) com as validações da 20250202000005
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

  -- Get voucher
  -- ✅ CORRIGIDO: Removido current_uses < max_uses do WHERE (verificar depois)
  SELECT * INTO v_voucher
  FROM vouchers
  WHERE code = voucher_code_param
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > NOW())
    AND voucher_type = 'subscription';
  
  IF v_voucher IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Voucher inválido, expirado ou não é um voucher de assinatura');
  END IF;

  -- ✅ CORRIGIDO: Verificar limite de usos usando APENAS uses_count (current_uses não existe mais na tabela)
  IF v_voucher.uses_count >= v_voucher.max_uses THEN
    RETURN jsonb_build_object('success', false, 'error', 'Voucher atingiu o limite de usos');
  END IF;

  -- Calculate new expiry
  v_new_expiry := NOW() + (v_voucher.duration_months || ' months')::INTERVAL;

  -- Se for plano coach, aplicar em coach_subscriptions
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
    
    -- Verificar se o voucher já foi usado por outro usuário
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
    
    -- Verificar se o usuário atual já usou este voucher
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
    
    -- Update or insert subscription
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
    -- Lógica Pro/Free
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

  -- ✅ CORRIGIDO: Increment voucher usage usando APENAS uses_count (current_uses não existe mais na tabela)
  UPDATE vouchers
  SET 
    uses_count = uses_count + 1,
    updated_at = NOW()
  WHERE code = voucher_code_param;

  RETURN jsonb_build_object(
    'success', true, 
    'plan', v_voucher.plan,
    'expires_at', v_new_expiry
  );
END;
$$;

COMMENT ON FUNCTION apply_voucher IS 
'Função para aplicar vouchers de subscription. Suporta planos free, pro e coach.
Corrigida para usar APENAS uses_count (current_uses não existe mais na tabela vouchers).';
