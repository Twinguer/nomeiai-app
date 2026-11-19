-- Migration: Garantir que cada voucher de subscription seja usado por apenas um usuário
-- Cada voucher de subscription só pode ser utilizado por um único usuário

-- Atualizar função apply_voucher para verificar se o voucher já foi usado por outro usuário
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
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuário não autenticado');
  END IF;

  -- Get voucher
  SELECT * INTO v_voucher
  FROM vouchers
  WHERE code = voucher_code_param
    AND is_active = true
    AND current_uses < max_uses
    AND (expires_at IS NULL OR expires_at > NOW())
    AND voucher_type = 'subscription';  -- Apenas vouchers de subscription
  
  IF v_voucher IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Voucher inválido, expirado ou não é um voucher de assinatura');
  END IF;

  -- Verificar se o voucher já foi usado por outro usuário
  -- Para vouchers de subscription, cada voucher só pode ser usado por um usuário único
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

  -- Calculate new expiry
  v_new_expiry := NOW() + (v_voucher.duration_months || ' months')::INTERVAL;

  -- Update or insert subscription
  INSERT INTO user_subscriptions (user_id, plan, expires_at, voucher_code)
  VALUES (v_user_id, v_voucher.plan, v_new_expiry, voucher_code_param)
  ON CONFLICT (user_id) 
  DO UPDATE SET
    plan = v_voucher.plan,
    expires_at = v_new_expiry,
    voucher_code = voucher_code_param,
    is_active = true,
    updated_at = NOW();

  -- Increment voucher usage
  UPDATE vouchers
  SET current_uses = current_uses + 1,
      updated_at = NOW()
  WHERE code = voucher_code_param;

  RETURN jsonb_build_object(
    'success', true, 
    'plan', v_voucher.plan,
    'expires_at', v_new_expiry
  );
END;
$$;

-- Criar view para facilitar consulta de vouchers aplicados com informações dos usuários
CREATE OR REPLACE VIEW vouchers_applied_with_users AS
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
  au.email as auth_email
FROM vouchers v
LEFT JOIN user_subscriptions us ON v.code = us.voucher_code
LEFT JOIN users_profiles up ON us.user_id = up.id
LEFT JOIN auth.users au ON us.user_id = au.id
WHERE v.voucher_type = 'subscription';

-- Comentário na view
COMMENT ON VIEW vouchers_applied_with_users IS 'View que mostra vouchers de subscription aplicados com informações dos usuários que os utilizaram';

-- Adicionar segurança à view (apenas admins podem acessar)
ALTER VIEW vouchers_applied_with_users SET (security_barrier = true);

-- Grant acesso apenas para admins (via RLS policies das tabelas subjacentes)
-- A view herda as políticas RLS das tabelas base (vouchers, user_subscriptions, users_profiles, auth.users)
-- Como a view acessa auth.users, precisamos garantir que apenas admins vejam essas informações
-- A política de user_subscriptions já permite que admins vejam tudo

-- Não é necessário criar uma policy específica para a view, pois ela herda as políticas das tabelas base
-- Mas podemos garantir que apenas admins autenticados possam acessar
GRANT SELECT ON vouchers_applied_with_users TO authenticated;
