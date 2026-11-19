-- Cole no SQL Editor do Supabase (Dashboard → SQL → New query)
-- Cria RPC ensure_launch_pro_for_current_user + concede Pro de lançamento aos Free existentes

CREATE OR REPLACE FUNCTION public.ensure_launch_pro_for_current_user()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  IF NOT public.is_launch_pro_promo_active() THEN
    RETURN;
  END IF;

  PERFORM public.grant_launch_pro_subscription(v_user_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_launch_pro_for_current_user() TO authenticated;

-- Backfill: usuários Free → Pro de lançamento (enquanto promo ativa)
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
       OR (us.plan = 'free'::subscription_plan AND us.is_active = true)
  LOOP
    PERFORM public.grant_launch_pro_subscription(v_user_id);
  END LOOP;
END;
$$;
