-- Migration: Adicionar suporte a cupom de desconto nos vouchers
-- Permite que vouchers funcionem como cupons de desconto em pagamentos

-- Criar enum para tipo de voucher
CREATE TYPE voucher_type AS ENUM ('subscription', 'discount');

-- Adicionar campos de desconto na tabela vouchers
ALTER TABLE vouchers 
ADD COLUMN IF NOT EXISTS voucher_type voucher_type NOT NULL DEFAULT 'subscription',
ADD COLUMN IF NOT EXISTS discount_type TEXT CHECK (discount_type IN ('percentage', 'fixed', NULL)),
ADD COLUMN IF NOT EXISTS discount_value NUMERIC(10, 2) CHECK (discount_value >= 0);

-- Adicionar comentários para documentação
COMMENT ON COLUMN vouchers.voucher_type IS 'Tipo de voucher: subscription (ativa plano grátis) ou discount (cupom de desconto)';
COMMENT ON COLUMN vouchers.discount_type IS 'Tipo de desconto: percentage (percentual) ou fixed (valor fixo). NULL se voucher_type = subscription';
COMMENT ON COLUMN vouchers.discount_value IS 'Valor do desconto: percentual (0-100) ou valor fixo em reais. NULL se voucher_type = subscription';

-- Criar função para validar voucher como cupom de desconto
CREATE OR REPLACE FUNCTION validate_discount_voucher(voucher_code_param TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_voucher RECORD;
BEGIN
  -- Buscar voucher
  SELECT * INTO v_voucher
  FROM vouchers
  WHERE code = voucher_code_param
    AND is_active = true
    AND current_uses < max_uses
    AND (expires_at IS NULL OR expires_at > NOW())
    AND voucher_type = 'discount';
  
  IF v_voucher IS NULL THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'Voucher inválido, expirado ou não é um cupom de desconto'
    );
  END IF;
  
  -- Validar campos de desconto
  IF v_voucher.discount_type IS NULL OR v_voucher.discount_value IS NULL THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'Voucher de desconto com configuração inválida'
    );
  END IF;
  
  -- Validar valores
  IF v_voucher.discount_type = 'percentage' AND (v_voucher.discount_value < 0 OR v_voucher.discount_value > 100) THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'Desconto percentual deve estar entre 0 e 100'
    );
  END IF;
  
  RETURN jsonb_build_object(
    'valid', true,
    'discount_type', v_voucher.discount_type,
    'discount_value', v_voucher.discount_value,
    'plan', v_voucher.plan,
    'description', v_voucher.description
  );
END;
$$;

-- Atualizar função apply_voucher para manter compatibilidade com vouchers de subscription
-- (não precisa alterar, ela já funciona para subscription)

-- Criar índice para melhorar performance nas consultas
CREATE INDEX IF NOT EXISTS idx_vouchers_type_active ON vouchers(voucher_type, is_active, expires_at);

