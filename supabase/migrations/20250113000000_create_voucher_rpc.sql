-- Migration: Criar função RPC para criar vouchers (bypass RLS)
-- Permite criar vouchers mesmo com RLS ativo, verificando se o usuário é admin

CREATE OR REPLACE FUNCTION create_voucher(
  p_code TEXT,
  p_voucher_type TEXT,
  p_plan TEXT,
  p_duration_months INTEGER,
  p_max_uses INTEGER,
  p_description TEXT DEFAULT NULL,
  p_expires_at TIMESTAMPTZ DEFAULT NULL,
  p_discount_type TEXT DEFAULT NULL,
  p_discount_value NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_is_admin BOOLEAN;
  v_voucher_id UUID;
BEGIN
  -- Obter ID do usuário atual
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuário não autenticado');
  END IF;
  
  -- Verificar se é admin
  v_is_admin := has_role(v_user_id, 'admin'::app_role);
  
  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('success', false, 'error', 'Apenas administradores podem criar vouchers');
  END IF;
  
  -- Validar plano
  IF p_plan NOT IN ('free', 'pro', 'coach_starter', 'coach_professional', 'coach_enterprise') THEN
    RETURN jsonb_build_object('success', false, 'error', format('Plano inválido: %s. Planos permitidos: free, pro, coach_starter, coach_professional, coach_enterprise', p_plan));
  END IF;
  
  -- Validar tipo de voucher
  IF p_voucher_type NOT IN ('subscription', 'discount') THEN
    RETURN jsonb_build_object('success', false, 'error', format('Tipo de voucher inválido: %s. Tipos permitidos: subscription, discount', p_voucher_type));
  END IF;
  
  -- Verificar se o código já existe
  IF EXISTS (SELECT 1 FROM vouchers WHERE code = p_code) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Código de voucher já existe');
  END IF;
  
  -- Inserir voucher
  -- ✅ Não especificar contador de usos - deixar o DEFAULT do banco (0)
  -- A coluna pode ser uses_count ou current_uses dependendo da migração aplicada
  INSERT INTO vouchers (
    code,
    voucher_type,
    plan,
    duration_months,
    max_uses,
    is_active,
    description,
    expires_at,
    created_by,
    discount_type,
    discount_value
  )
  VALUES (
    p_code,
    p_voucher_type,
    p_plan,
    p_duration_months,
    p_max_uses,
    true,
    p_description,
    p_expires_at,
    v_user_id,
    p_discount_type,
    p_discount_value
  )
  RETURNING id INTO v_voucher_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'voucher_id', v_voucher_id,
    'code', p_code,
    'plan', p_plan
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

COMMENT ON FUNCTION create_voucher IS 'Função RPC para criar vouchers. Apenas administradores podem usar. Bypassa RLS usando SECURITY DEFINER.';

GRANT EXECUTE ON FUNCTION create_voucher TO authenticated;

