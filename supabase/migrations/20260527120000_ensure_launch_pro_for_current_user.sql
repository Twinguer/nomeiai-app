-- Permite ao cliente garantir Pro de lançamento para auth.uid() (promo ativa).
-- Idempotente: delega a grant_launch_pro_subscription.

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

COMMENT ON FUNCTION public.ensure_launch_pro_for_current_user() IS
  'Concede Pro de lançamento ao usuário autenticado se a promo estiver ativa.';

GRANT EXECUTE ON FUNCTION public.ensure_launch_pro_for_current_user() TO authenticated;
