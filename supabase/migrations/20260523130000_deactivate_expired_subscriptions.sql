-- Desativa assinaturas Pro/Coach com expires_at no passado mas is_active/status ainda ativos.
-- Corrige dados legados e evita divergência entre Stripe, banco e UI.

CREATE OR REPLACE FUNCTION public.deactivate_expired_subscriptions()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_count INTEGER := 0;
  v_coach_count INTEGER := 0;
BEGIN
  UPDATE public.user_subscriptions
  SET
    is_active = false,
    updated_at = NOW()
  WHERE is_active = true
    AND expires_at IS NOT NULL
    AND expires_at <= NOW();

  GET DIAGNOSTICS v_user_count = ROW_COUNT;

  UPDATE public.coach_subscriptions
  SET
    status = 'cancelled',
    updated_at = NOW()
  WHERE status = 'active'
    AND expires_at IS NOT NULL
    AND expires_at <= NOW();

  GET DIAGNOSTICS v_coach_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'user_subscriptions_deactivated', v_user_count,
    'coach_subscriptions_cancelled', v_coach_count,
    'ran_at', NOW()
  );
END;
$$;

COMMENT ON FUNCTION public.deactivate_expired_subscriptions() IS
  'Desativa Pro e cancela Coach quando expires_at já passou. Pode rodar via cron ou após verify-stripe.';

GRANT EXECUTE ON FUNCTION public.deactivate_expired_subscriptions() TO service_role;

-- Correção imediata dos registros existentes
SELECT public.deactivate_expired_subscriptions();

-- is_user_pro: alinha is_active/status ao consultar (por usuário)
CREATE OR REPLACE FUNCTION public.is_user_pro(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_pro BOOLEAN;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN false;
  END IF;

  UPDATE public.user_subscriptions
  SET
    is_active = false,
    updated_at = NOW()
  WHERE user_id = p_user_id
    AND is_active = true
    AND expires_at IS NOT NULL
    AND expires_at <= NOW();

  SELECT EXISTS (
    SELECT 1
    FROM public.user_subscriptions
    WHERE user_id = p_user_id
      AND is_active = true
      AND plan = 'pro'
      AND (expires_at IS NULL OR expires_at > NOW())
  ) INTO v_is_pro;

  RETURN v_is_pro;
END;
$$;

COMMENT ON FUNCTION public.is_user_pro(UUID) IS
  'Pro válido: plan=pro, is_active e não expirado. Desativa automaticamente linhas expiradas do usuário.';
