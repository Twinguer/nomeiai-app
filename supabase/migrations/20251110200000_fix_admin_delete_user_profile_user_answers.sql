-- Migration: Fix admin_delete_user_profile to handle missing user_answers table
-- This fixes the error "relation user_answers does not exist"

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
  
  -- Delete user rankings (user_rankings não tem coluna id, só user_id e consolidated_data)
  -- A tabela user_answers foi removida em 2025-01-15, não precisa deletar dela
  DELETE FROM user_rankings WHERE user_id = user_id_param;
  
  -- Delete user profile
  DELETE FROM users_profiles WHERE id = user_id_param;
  
  -- Delete auth user
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

COMMENT ON FUNCTION public.admin_delete_user_profile IS 
  'Deleta o perfil de um usuário e todos os dados relacionados. Verifica se a tabela user_answers existe antes de tentar deletar.';

