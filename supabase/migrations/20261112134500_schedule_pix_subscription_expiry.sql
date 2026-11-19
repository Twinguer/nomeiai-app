-- O status persistido acompanha o vencimento + tolerância de cinco dias.
-- As funções de autorização também conferem a data diretamente.
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
  SET plan = 'free'::subscription_plan, is_active = false, updated_at = NOW()
  WHERE plan = 'pro'::subscription_plan
    AND is_active = true
    AND expires_at IS NOT NULL
    AND expires_at + INTERVAL '5 days' <= NOW();
  GET DIAGNOSTICS v_user_count = ROW_COUNT;

  UPDATE public.coach_subscriptions
  SET status = 'expired', updated_at = NOW()
  WHERE status = 'active'
    AND expires_at IS NOT NULL
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

DO $schedule_expired_subscriptions$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    BEGIN
      PERFORM cron.unschedule('deactivate-expired-subscriptions-daily');
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
    PERFORM cron.schedule(
      'deactivate-expired-subscriptions-daily',
      '*/15 * * * *',
      'SELECT public.deactivate_expired_subscriptions();'
    );
  ELSE
    RAISE NOTICE 'pg_cron não habilitado; acesso aplica a tolerância, mas a limpeza exige agendador.';
  END IF;
EXCEPTION
  WHEN undefined_table OR invalid_schema_name THEN
    RAISE NOTICE 'pg_cron indisponível; acesso aplica a tolerância, mas a limpeza exige agendador.';
END;
$schedule_expired_subscriptions$;
