-- Pagamentos mensais avulsos via Pix para Pro e Coach, com 5 dias de tolerÃ¢ncia.

CREATE TABLE IF NOT EXISTS public.billing_payment_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL CHECK (plan_id IN ('pro', 'coach_starter')),
  provider TEXT NOT NULL DEFAULT 'mercadopago' CHECK (provider = 'mercadopago'),
  amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'BRL' CHECK (currency = 'BRL'),
  status TEXT NOT NULL DEFAULT 'pending',
  external_reference TEXT NOT NULL UNIQUE,
  preference_id TEXT UNIQUE,
  provider_payment_id TEXT,
  voucher_code TEXT,
  paid_at TIMESTAMPTZ,
  period_starts_at TIMESTAMPTZ,
  period_ends_at TIMESTAMPTZ,
  provider_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_payment_orders_user_created
  ON public.billing_payment_orders (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_billing_payment_orders_status
  ON public.billing_payment_orders (status, created_at DESC);

ALTER TABLE public.billing_payment_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own billing payment orders" ON public.billing_payment_orders;
CREATE POLICY "Users can view own billing payment orders"
  ON public.billing_payment_orders FOR SELECT
  USING (auth.uid() = user_id);

REVOKE INSERT, UPDATE, DELETE ON public.billing_payment_orders FROM anon, authenticated;
GRANT SELECT ON public.billing_payment_orders TO authenticated;

CREATE OR REPLACE FUNCTION public.process_mercadopago_payment(
  p_order_id UUID,
  p_payment_id TEXT,
  p_status TEXT,
  p_amount NUMERIC,
  p_currency TEXT,
  p_paid_at TIMESTAMPTZ,
  p_provider_data JSONB DEFAULT '{}'::JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.billing_payment_orders%ROWTYPE;
  v_current_expires_at TIMESTAMPTZ;
  v_current_plan TEXT;
  v_period_start TIMESTAMPTZ;
  v_period_end TIMESTAMPTZ;
  v_previous_period_end TIMESTAMPTZ;
  v_paid_at TIMESTAMPTZ := COALESCE(p_paid_at, NOW());
BEGIN
  SELECT * INTO v_order
  FROM public.billing_payment_orders
  WHERE id = p_order_id AND provider = 'mercadopago'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido de pagamento nÃ£o encontrado';
  END IF;

  IF v_order.status = 'approved'
     AND v_order.provider_payment_id IS NOT NULL
     AND v_order.provider_payment_id <> p_payment_id THEN
    RETURN jsonb_build_object('processed', true, 'duplicate', true);
  END IF;

  IF p_status = 'approved' THEN
    IF p_currency IS DISTINCT FROM 'BRL'
       OR p_amount IS NULL
       OR ROUND(p_amount, 2) <> v_order.amount THEN
      RAISE EXCEPTION 'Valor ou moeda do pagamento nÃ£o corresponde ao pedido';
    END IF;

    IF v_order.status = 'approved' THEN
      RETURN jsonb_build_object('processed', true, 'duplicate', true);
    END IF;

    IF v_order.plan_id = 'pro' THEN
      SELECT plan::TEXT, expires_at INTO v_current_plan, v_current_expires_at
      FROM public.user_subscriptions
      WHERE user_id = v_order.user_id
      FOR UPDATE;

      IF v_current_plan = 'pro'
         AND v_current_expires_at IS NOT NULL
         AND v_current_expires_at + INTERVAL '5 days' >= v_paid_at THEN
        v_period_start := v_current_expires_at;
      ELSE
        v_period_start := v_paid_at;
      END IF;
      v_period_end := v_period_start + INTERVAL '1 month';

      INSERT INTO public.user_subscriptions (
        user_id, plan, is_active, started_at, expires_at, voucher_code, updated_at
      ) VALUES (
        v_order.user_id, 'pro', true, v_period_start, v_period_end, NULL, NOW()
      )
      ON CONFLICT (user_id) DO UPDATE SET
        plan = 'pro', is_active = true, started_at = EXCLUDED.started_at,
        expires_at = EXCLUDED.expires_at, voucher_code = NULL, updated_at = NOW();
    ELSIF v_order.plan_id = 'coach_starter' THEN
      SELECT expires_at INTO v_current_expires_at
      FROM public.coach_subscriptions
      WHERE coach_id = v_order.user_id
        AND plan_type = 'starter'
      FOR UPDATE;

      IF v_current_expires_at IS NOT NULL
         AND v_current_expires_at + INTERVAL '5 days' >= v_paid_at THEN
        v_period_start := v_current_expires_at;
      ELSE
        v_period_start := v_paid_at;
      END IF;
      v_period_end := v_period_start + INTERVAL '1 month';

      INSERT INTO public.coach_subscriptions (
        coach_id, plan_type, status, max_students, price, expires_at, updated_at
      ) VALUES (
        v_order.user_id, 'starter', 'active', 5, 49.90, v_period_end, NOW()
      )
      ON CONFLICT (coach_id) DO UPDATE SET
        plan_type = 'starter', status = 'active', max_students = 5,
        price = 49.90, expires_at = EXCLUDED.expires_at, updated_at = NOW();
    ELSE
      RAISE EXCEPTION 'Plano nÃ£o suportado';
    END IF;

    UPDATE public.billing_payment_orders SET
      status = 'approved', provider_payment_id = p_payment_id,
      paid_at = v_paid_at, period_starts_at = v_period_start,
      period_ends_at = v_period_end, provider_data = p_provider_data,
      updated_at = NOW()
    WHERE id = v_order.id;

    IF v_order.voucher_code IS NOT NULL THEN
      UPDATE public.vouchers
      SET uses_count = COALESCE(uses_count, 0) + 1,
          updated_at = NOW()
      WHERE code = v_order.voucher_code AND voucher_type = 'discount';
    END IF;

    RETURN jsonb_build_object(
      'processed', true, 'duplicate', false,
      'plan_id', v_order.plan_id, 'expires_at', v_period_end
    );
  END IF;

  IF p_status IN ('refunded', 'charged_back') THEN
    UPDATE public.billing_payment_orders SET
      status = p_status, provider_payment_id = p_payment_id,
      provider_data = p_provider_data, updated_at = NOW()
    WHERE id = v_order.id;

    IF v_order.status = 'approved' AND v_order.plan_id = 'pro'
       AND v_order.period_ends_at IS NOT NULL THEN
      SELECT MAX(period_ends_at) INTO v_previous_period_end
      FROM public.billing_payment_orders
      WHERE user_id = v_order.user_id AND plan_id = 'pro'
        AND status = 'approved' AND id <> v_order.id;
      UPDATE public.user_subscriptions
      SET plan = CASE WHEN v_previous_period_end IS NOT NULL
                           AND v_previous_period_end + INTERVAL '5 days' > NOW()
                      THEN 'pro'::subscription_plan ELSE 'free'::subscription_plan END,
          is_active = v_previous_period_end IS NOT NULL
                      AND v_previous_period_end + INTERVAL '5 days' > NOW(),
          expires_at = v_previous_period_end,
          voucher_code = NULL, updated_at = NOW()
      WHERE user_id = v_order.user_id AND plan = 'pro'
        AND expires_at = v_order.period_ends_at;
    ELSIF v_order.status = 'approved' AND v_order.plan_id = 'coach_starter'
       AND v_order.period_ends_at IS NOT NULL THEN
      SELECT MAX(period_ends_at) INTO v_previous_period_end
      FROM public.billing_payment_orders
      WHERE user_id = v_order.user_id AND plan_id = 'coach_starter'
        AND status = 'approved' AND id <> v_order.id;
      UPDATE public.coach_subscriptions
      SET status = CASE WHEN v_previous_period_end IS NOT NULL
                             AND v_previous_period_end + INTERVAL '5 days' > NOW()
                        THEN 'active' ELSE 'cancelled' END,
          expires_at = v_previous_period_end, updated_at = NOW()
      WHERE coach_id = v_order.user_id AND status = 'active'
        AND expires_at = v_order.period_ends_at;
    END IF;
    RETURN jsonb_build_object('processed', true, 'duplicate', false);
  END IF;

  -- NotificaÃ§Ãµes atrasadas nÃ£o podem rebaixar um pedido jÃ¡ aprovado.
  IF v_order.status <> 'approved' THEN
    UPDATE public.billing_payment_orders SET
      status = p_status, provider_payment_id = p_payment_id,
      provider_data = p_provider_data, updated_at = NOW()
    WHERE id = v_order.id;
  END IF;

  RETURN jsonb_build_object('processed', true, 'duplicate', false);
END;
$$;

REVOKE ALL ON FUNCTION public.process_mercadopago_payment(UUID, TEXT, TEXT, NUMERIC, TEXT, TIMESTAMPTZ, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_mercadopago_payment(UUID, TEXT, TEXT, NUMERIC, TEXT, TIMESTAMPTZ, JSONB) TO service_role;

-- O prazo de acesso Ã© o vencimento do plano mais cinco dias de tolerÃ¢ncia.
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
  SET is_active = false, updated_at = NOW()
  WHERE is_active = true AND expires_at IS NOT NULL
    AND expires_at + INTERVAL '5 days' <= NOW();
  GET DIAGNOSTICS v_user_count = ROW_COUNT;

  UPDATE public.coach_subscriptions
  SET status = 'expired', updated_at = NOW()
  WHERE status = 'active' AND expires_at IS NOT NULL
    AND expires_at + INTERVAL '5 days' <= NOW();
  GET DIAGNOSTICS v_coach_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'user_subscriptions_deactivated', v_user_count,
    'coach_subscriptions_expired', v_coach_count,
    'ran_at', NOW()
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.deactivate_expired_subscriptions() TO service_role;

CREATE OR REPLACE FUNCTION public.get_user_subscription_plan(p_user_id UUID)
RETURNS subscription_plan
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT plan FROM public.user_subscriptions
  WHERE user_id = p_user_id AND is_active = true
    AND (expires_at IS NULL OR expires_at + INTERVAL '5 days' > NOW())
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_user_pro(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_subscriptions
    WHERE user_id = p_user_id AND is_active = true
      AND plan = 'pro'::subscription_plan
      AND (expires_at IS NULL OR expires_at + INTERVAL '5 days' > NOW())
  );
$$;

CREATE OR REPLACE FUNCTION public.check_if_can_invite_student(p_coach_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subscription RECORD;
BEGIN
  SELECT max_students, COALESCE(current_students, 0), status, expires_at
  INTO v_subscription FROM public.coach_subscriptions
  WHERE coach_id = p_coach_id;

  IF NOT FOUND OR v_subscription.status <> 'active'
     OR (v_subscription.expires_at IS NOT NULL
         AND v_subscription.expires_at + INTERVAL '5 days' <= NOW()) THEN
    RETURN jsonb_build_object('can_invite', false, 'reason', 'Plano Coach expirado. Renove para continuar.');
  END IF;

  IF v_subscription.current_students >= v_subscription.max_students THEN
    RETURN jsonb_build_object(
      'can_invite', false, 'reason', 'Limite atingido',
      'current', v_subscription.current_students,
      'max', v_subscription.max_students, 'slots_free', 0
    );
  END IF;

  RETURN jsonb_build_object(
    'can_invite', true, 'current', v_subscription.current_students,
    'max', v_subscription.max_students,
    'slots_free', v_subscription.max_students - v_subscription.current_students
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.check_if_can_invite_student(UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.check_coach_has_student_access(
  p_coach_id UUID, p_student_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_has_relationship BOOLEAN := false;
BEGIN
  IF v_caller IS NULL OR v_caller IS DISTINCT FROM p_coach_id THEN
    RETURN json_build_object('allowed', false, 'reason', 'forbidden_coach', 'message', 'Acesso negado');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.coach_subscriptions cs
    WHERE cs.coach_id = p_coach_id AND cs.status = 'active'
      AND (cs.expires_at IS NULL OR cs.expires_at + INTERVAL '5 days' > NOW())
  ) THEN
    RETURN json_build_object('allowed', false, 'reason', 'no_active_subscription',
      'message', 'Plano Coach expirado. Renove em Modo Coach > Assinatura.');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.coach_profiles cp
    CROSS JOIN LATERAL jsonb_array_elements(cp.student_relationships) AS rel(value)
    WHERE cp.coach_id = p_coach_id
      AND (rel.value->>'student_id')::uuid = p_student_id
      AND COALESCE(NULLIF(trim(rel.value->>'status'), ''), 'active') = 'active'
  ) INTO v_has_relationship;

  IF NOT v_has_relationship THEN
    RETURN json_build_object('allowed', false, 'reason', 'not_in_team',
      'message', 'Aluno nÃ£o faz parte da sua equipe ou vÃ­nculo inativo');
  END IF;

  RETURN json_build_object('allowed', true, 'reason', 'ok');
END;
$$;
GRANT EXECUTE ON FUNCTION public.check_coach_has_student_access(UUID, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_user_coach(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.coach_subscriptions
    WHERE coach_id = p_user_id AND status = 'active'
      AND (expires_at IS NULL OR expires_at + INTERVAL '5 days' > NOW())
  );
$$;

CREATE OR REPLACE FUNCTION public.check_free_user_ranking_limits(
  p_user_id UUID,
  p_concurso_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_paid BOOLEAN;
  v_is_creator BOOLEAN;
  v_participation_count INTEGER := 0;
BEGIN
  v_is_paid := public.is_user_pro(p_user_id) OR public.is_user_coach(p_user_id);
  IF v_is_paid THEN
    RETURN json_build_object('allowed', true, 'reason', 'pro_user', 'is_pro', true);
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.concursos
    WHERE id = p_concurso_id AND created_by_user_id = p_user_id
  ) INTO v_is_creator;
  IF v_is_creator THEN
    RETURN json_build_object('allowed', true, 'reason', 'is_creator', 'is_creator', true, 'is_pro', false);
  END IF;

  SELECT COUNT(DISTINCT (ranking_data->>'concurso_id')::UUID)
  INTO v_participation_count
  FROM public.user_rankings ur,
    LATERAL jsonb_each(ur.consolidated_data->'rankings') AS rankings(ranking_key, ranking_data)
  WHERE ur.user_id = p_user_id
    AND ur.consolidated_data IS NOT NULL
    AND ur.consolidated_data <> '{}'::JSONB
    AND ur.consolidated_data ? 'rankings'
    AND (ranking_data->>'concurso_id')::UUID IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.concursos c
      WHERE c.id = (ranking_data->>'concurso_id')::UUID
        AND c.created_by_user_id = p_user_id
    );

  IF v_participation_count >= 2 THEN
    RETURN json_build_object(
      'allowed', false, 'reason', 'max_participations_reached',
      'current_count', v_participation_count, 'max_allowed', 2, 'is_pro', false,
      'message', 'UsuÃ¡rios Free podem participar de atÃ© 2 rankings que nÃ£o criaram.'
    );
  END IF;
  RETURN json_build_object(
    'allowed', true, 'reason', 'within_limits',
    'current_count', v_participation_count, 'max_allowed', 2, 'is_pro', false
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.check_free_user_edit_limits(
  p_user_id UUID,
  p_ranking_id TEXT,
  p_current_edit_count INT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_user_pro(p_user_id) OR public.is_user_coach(p_user_id) THEN
    RETURN json_build_object(
      'allowed', true, 'reason', 'pro_user', 'is_pro', true, 'remaining_edits', NULL
    );
  END IF;
  IF p_current_edit_count >= 3 THEN
    RETURN json_build_object(
      'allowed', false, 'reason', 'max_edits_reached',
      'current_count', p_current_edit_count, 'max_allowed', 3,
      'remaining_edits', 0, 'is_pro', false,
      'message', 'VocÃª atingiu o limite de 3 ediÃ§Ãµes para usuÃ¡rios Free.'
    );
  END IF;
  RETURN json_build_object(
    'allowed', true, 'reason', 'within_limits',
    'current_count', p_current_edit_count, 'max_allowed', 3,
    'remaining_edits', 3 - p_current_edit_count, 'is_pro', false
  );
END;
$$;

INSERT INTO supabase_migrations.schema_migrations (version,name) VALUES ('20261112120000','pix_monthly_payments');
