-- Fix admin_delete_user_profile to avoid referencing removed tables and ensure admin permissions
-- Create or replace the function with safe deletes and logging
CREATE OR REPLACE FUNCTION public.admin_delete_user_profile(user_id_param uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_admin boolean;
BEGIN
  -- Check admin role
  SELECT has_role(auth.uid(), 'admin'::app_role) INTO is_admin;
  IF NOT is_admin THEN
    INSERT INTO security_logs(action, details, user_id)
    VALUES ('unauthorized_admin_delete_attempt', jsonb_build_object('target_user_id', user_id_param), auth.uid());
    RETURN false;
  END IF;

  -- Ensure target user exists
  IF NOT EXISTS (SELECT 1 FROM users_profiles WHERE id = user_id_param) THEN
    RETURN false;
  END IF;

  -- Try to delete related score logs (ignore if blocked by RLS and log)
  BEGIN
    DELETE FROM score_calculation_logs WHERE user_ranking_id = user_id_param;
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO security_logs(action, details, user_id)
    VALUES (
      'admin_delete_user_profile_error',
      jsonb_build_object('error', SQLERRM, 'target_user_id', user_id_param, 'step', 'delete_score_logs'),
      auth.uid()
    );
  END;

  -- Try to delete consolidated rankings for the user (ignore if blocked by RLS and log)
  BEGIN
    DELETE FROM user_rankings WHERE user_id = user_id_param;
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO security_logs(action, details, user_id)
    VALUES (
      'admin_delete_user_profile_error',
      jsonb_build_object('error', SQLERRM, 'target_user_id', user_id_param, 'step', 'delete_user_rankings'),
      auth.uid()
    );
  END;

  -- Finally delete the profile (policy already allows admins to delete)
  DELETE FROM users_profiles WHERE id = user_id_param;

  RETURN true;
END;
$$;

-- Ensure admins can delete from user_rankings (needed for the function)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies p
    WHERE p.schemaname = 'public' AND p.tablename = 'user_rankings' AND p.policyname = 'Admins can delete user_rankings'
  ) THEN
    CREATE POLICY "Admins can delete user_rankings"
      ON public.user_rankings
      FOR DELETE
      USING (has_role(auth.uid(), 'admin'::app_role));
  END IF;
END $$;

-- Ensure admins can delete from score_calculation_logs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies p
    WHERE p.schemaname = 'public' AND p.tablename = 'score_calculation_logs' AND p.policyname = 'Admins can delete score logs'
  ) THEN
    CREATE POLICY "Admins can delete score logs"
      ON public.score_calculation_logs
      FOR DELETE
      USING (has_role(auth.uid(), 'admin'::app_role));
  END IF;
END $$;