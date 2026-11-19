-- Migration: Remove followers/following system completely
-- This removes the user_followers table, RPC functions, and related policies

-- 1. Remove RPC functions related to followers
DROP FUNCTION IF EXISTS public.get_followers_list(uuid);
DROP FUNCTION IF EXISTS public.get_following_list(uuid);
DROP FUNCTION IF EXISTS public.count_user_followers(uuid);

-- 2. Update admin_delete_user_profile to remove user_followers reference
-- This function is used for admin operations, so we need to update it
CREATE OR REPLACE FUNCTION public.admin_delete_user_profile(user_id_param uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- SECURITY: Verify user has admin role
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    INSERT INTO security_logs (user_id, action, details)
    VALUES (auth.uid(), 'unauthorized_admin_delete_attempt', jsonb_build_object(
        'target_user_id', user_id_param
    ));
    RETURN FALSE;
  END IF;

  -- Log admin action
  INSERT INTO security_logs (user_id, action, details)
  VALUES (auth.uid(), 'admin_delete_user_profile', jsonb_build_object(
      'target_user_id', user_id_param,
      'authorized', true
  ));
  
  -- Sistema de seguidores removido - não deletar mais de user_followers
  
  DELETE FROM user_answers
  WHERE user_ranking_id IN (
    SELECT id FROM user_rankings WHERE user_id = user_id_param
  );
  
  DELETE FROM user_rankings WHERE user_id = user_id_param;
  DELETE FROM users_profiles WHERE id = user_id_param;
  DELETE FROM auth.users WHERE id = user_id_param;
  
  RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO security_logs (user_id, action, details)
  VALUES (auth.uid(), 'admin_delete_user_profile_error', jsonb_build_object(
      'target_user_id', user_id_param,
      'error', SQLERRM
  ));
  RETURN FALSE;
END;
$function$;

-- 3. Drop RLS policies for user_followers (if they exist)
DROP POLICY IF EXISTS "Users can view own follower relationships" ON public.user_followers;
DROP POLICY IF EXISTS "Users can create own follower relationships" ON public.user_followers;
DROP POLICY IF EXISTS "Users can delete own follower relationships" ON public.user_followers;
DROP POLICY IF EXISTS "Users can view their follower relationships" ON public.user_followers;
DROP POLICY IF EXISTS "Users can manage their follower relationships" ON public.user_followers;
DROP POLICY IF EXISTS "Allow public read access to user_followers" ON public.user_followers;
DROP POLICY IF EXISTS "Allow anyone to read followers" ON public.user_followers;
DROP POLICY IF EXISTS "Users can view all followers" ON public.user_followers;

-- 4. Drop the user_followers table
-- Note: This will fail if there are foreign key constraints, but we're removing it anyway
DROP TABLE IF EXISTS public.user_followers CASCADE;

-- 5. Log the migration
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'security_logs') THEN
    INSERT INTO security_logs (user_id, action, details)
    VALUES (
      COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
      'followers_system_removed',
      jsonb_build_object(
        'migration_type', 'remove_followers_system',
        'timestamp', now()
      )
    );
  END IF;
END $$;


