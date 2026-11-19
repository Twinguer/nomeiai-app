-- Create self-service delete_user_profile function for authenticated users
-- Ensures only the owner can delete and cleans related data safely
CREATE OR REPLACE FUNCTION public.delete_user_profile(user_id_param uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  -- Authorization: only the user himself can delete
  IF v_uid IS NULL OR v_uid <> user_id_param THEN
    -- Best-effort log when table exists
    IF to_regclass('public.security_logs') IS NOT NULL THEN
      INSERT INTO public.security_logs(user_id, action, details)
      VALUES (v_uid, 'unauthorized_self_delete_attempt', jsonb_build_object('target_user_id', user_id_param));
    END IF;
    RETURN false;
  END IF;

  -- Delete user answers if table exists
  IF to_regclass('public.user_answers') IS NOT NULL THEN
    DELETE FROM public.user_answers
    WHERE user_ranking_id IN (
      SELECT id FROM public.user_rankings WHERE user_id = user_id_param
    );
  END IF;

  -- Delete rankings
  IF to_regclass('public.user_rankings') IS NOT NULL THEN
    DELETE FROM public.user_rankings WHERE user_id = user_id_param;
  END IF;

  -- Nullify references without cascade (vouchers.created_by, concursos.created_by_user_id)
  IF to_regclass('public.vouchers') IS NOT NULL THEN
    UPDATE public.vouchers SET created_by = NULL WHERE created_by = user_id_param;
  END IF;
  IF to_regclass('public.concursos') IS NOT NULL THEN
    UPDATE public.concursos SET created_by_user_id = NULL WHERE created_by_user_id = user_id_param;
  END IF;

  -- Coach cleanup
  IF to_regclass('public.coach_subscriptions') IS NOT NULL THEN
    DELETE FROM public.coach_subscriptions WHERE coach_id = user_id_param;
  END IF;
  IF to_regclass('public.coach_profiles') IS NOT NULL THEN
    DELETE FROM public.coach_profiles WHERE coach_id = user_id_param;
  END IF;
  IF to_regclass('public.coach_access_logs') IS NOT NULL THEN
    DELETE FROM public.coach_access_logs WHERE coach_id = user_id_param OR student_id = user_id_param;
  END IF;
  IF to_regclass('public.coach_invitations_history') IS NOT NULL THEN
    DELETE FROM public.coach_invitations_history WHERE coach_id = user_id_param OR student_id = user_id_param;
  END IF;

  -- Study groups: membership and coach references
  IF to_regclass('public.study_group_members') IS NOT NULL THEN
    DELETE FROM public.study_group_members WHERE user_id = user_id_param;
  END IF;
  IF to_regclass('public.study_groups') IS NOT NULL THEN
    UPDATE public.study_groups SET coach_id = NULL WHERE coach_id = user_id_param;
    UPDATE public.study_groups SET created_by = NULL WHERE created_by = user_id_param;
  END IF;

  -- Vouchers applied, notifications, roles
  IF to_regclass('public.vouchers_applied') IS NOT NULL THEN
    DELETE FROM public.vouchers_applied WHERE user_id = user_id_param;
  END IF;
  IF to_regclass('public.notifications') IS NOT NULL THEN
    DELETE FROM public.notifications WHERE user_id = user_id_param;
  END IF;
  IF to_regclass('public.user_roles') IS NOT NULL THEN
    DELETE FROM public.user_roles WHERE user_id = user_id_param;
  END IF;

  -- Logs (clear FK)
  IF to_regclass('public.security_logs') IS NOT NULL THEN
    DELETE FROM public.security_logs
    WHERE user_id = user_id_param
       OR details->>'target_user_id' = user_id_param::text;
  END IF;
  IF to_regclass('public.audit_logs') IS NOT NULL THEN
    DELETE FROM public.audit_logs WHERE user_id = user_id_param;
  END IF;
  IF to_regclass('public.audit_trail') IS NOT NULL THEN
    DELETE FROM public.audit_trail WHERE user_id = user_id_param;
  END IF;
  IF to_regclass('public.error_logs') IS NOT NULL THEN
    DELETE FROM public.error_logs WHERE user_id = user_id_param;
  END IF;

  -- Delete profile
  IF to_regclass('public.users_profiles') IS NOT NULL THEN
    DELETE FROM public.users_profiles WHERE id = user_id_param;
  END IF;

  -- Delete auth user (last)
  DELETE FROM auth.users WHERE id = user_id_param;

  -- (Opcional) Não registrar sucesso para evitar FK após excluir auth.users
  -- Caso queira registrar, mover log para antes do delete de auth.users.

  RETURN true;
EXCEPTION WHEN OTHERS THEN
  -- Log failure
  IF to_regclass('public.security_logs') IS NOT NULL THEN
    INSERT INTO public.security_logs(user_id, action, details)
    VALUES (NULL, 'self_delete_user_profile_error', jsonb_build_object('target_user_id', user_id_param, 'error', SQLERRM));
  END IF;
  RETURN false;
END;
$$;


