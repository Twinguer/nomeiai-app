-- Promo de lançamento: Aluno Pro gratuito para novos cadastros (e usuários Free existentes)
-- até a data fixa abaixo. Modo Coach permanece assinatura separada.

CREATE OR REPLACE FUNCTION public.get_launch_pro_promo_end_at()
RETURNS TIMESTAMPTZ
LANGUAGE sql
STABLE
AS $$
  SELECT TIMESTAMPTZ '2026-08-17 23:59:59+00';
$$;

COMMENT ON FUNCTION public.get_launch_pro_promo_end_at() IS
  'Data fim da promo Pro grátis no lançamento. Manter alinhado com src/config/launchPromo.ts';

CREATE OR REPLACE FUNCTION public.is_launch_pro_promo_active()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT NOW() < public.get_launch_pro_promo_end_at();
$$;

CREATE OR REPLACE FUNCTION public.grant_launch_pro_subscription(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing public.user_subscriptions%ROWTYPE;
  v_end_at TIMESTAMPTZ := public.get_launch_pro_promo_end_at();
BEGIN
  IF p_user_id IS NULL THEN
    RETURN;
  END IF;

  IF NOT public.is_launch_pro_promo_active() THEN
    INSERT INTO public.user_subscriptions (user_id, plan, is_active, started_at)
    VALUES (p_user_id, 'free'::subscription_plan, true, NOW())
    ON CONFLICT (user_id) DO NOTHING;
    RETURN;
  END IF;

  SELECT *
  INTO v_existing
  FROM public.user_subscriptions
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    INSERT INTO public.user_subscriptions (
      user_id,
      plan,
      is_active,
      started_at,
      expires_at,
      voucher_code
    )
    VALUES (
      p_user_id,
      'pro'::subscription_plan,
      true,
      NOW(),
      v_end_at,
      'launch_promo'
    );
    RETURN;
  END IF;

  -- Não alterar Pro pago (Stripe/voucher comercial) ou Coach
  IF v_existing.plan = 'pro'::subscription_plan
     AND v_existing.voucher_code IS DISTINCT FROM 'launch_promo'
     AND (
       v_existing.expires_at IS NULL
       OR v_existing.expires_at > v_end_at
     ) THEN
    RETURN;
  END IF;

  IF v_existing.plan = 'free'::subscription_plan
     OR (
       v_existing.plan = 'pro'::subscription_plan
       AND v_existing.voucher_code = 'launch_promo'
     )
     OR NOT v_existing.is_active THEN
    UPDATE public.user_subscriptions
    SET
      plan = 'pro'::subscription_plan,
      is_active = true,
      expires_at = v_end_at,
      voucher_code = 'launch_promo',
      updated_at = NOW()
    WHERE user_id = p_user_id;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.grant_launch_pro_subscription(UUID) IS
  'Concede Pro de lançamento (launch_promo) se a promo estiver ativa. Não sobrescreve assinaturas pagas.';

-- Novos cadastros: perfil + Pro de lançamento (ou Free após fim da promo)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name TEXT;
  v_nickname TEXT;
BEGIN
  v_name := COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1));

  v_nickname := NEW.raw_user_meta_data->>'nickname';

  IF v_nickname IS NULL OR TRIM(v_nickname) = '' THEN
    v_nickname := generate_unique_nickname(v_name);
  ELSE
    v_nickname := LOWER(REGEXP_REPLACE(TRIM(v_nickname), '[^a-z0-9_]', '', 'g'));

    IF v_nickname !~ '^[a-z0-9_]{3,20}$' THEN
      v_nickname := generate_unique_nickname(v_name);
    ELSE
      IF EXISTS (SELECT 1 FROM users_profiles WHERE LOWER(nickname) = LOWER(v_nickname)) THEN
        v_nickname := generate_unique_nickname(v_name);
      END IF;
    END IF;
  END IF;

  INSERT INTO public.users_profiles (id, email, name, nickname, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    v_name,
    v_nickname,
    NOW(),
    NOW()
  );

  PERFORM public.grant_launch_pro_subscription(NEW.id);

  RETURN NEW;
EXCEPTION
  WHEN unique_violation THEN
    PERFORM public.grant_launch_pro_subscription(NEW.id);
    RETURN NEW;
  WHEN OTHERS THEN
    RAISE WARNING 'Erro ao criar perfil para usuário %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- Usuários já cadastrados em plano Free: incluir na promo enquanto ativa
DO $$
DECLARE
  v_user_id UUID;
BEGIN
  IF NOT public.is_launch_pro_promo_active() THEN
    RETURN;
  END IF;

  FOR v_user_id IN
    SELECT u.id
    FROM auth.users u
    LEFT JOIN public.user_subscriptions us ON us.user_id = u.id
    WHERE us.user_id IS NULL
       OR (
         us.plan = 'free'::subscription_plan
         AND us.is_active = true
       )
  LOOP
    PERFORM public.grant_launch_pro_subscription(v_user_id);
  END LOOP;
END;
$$;
