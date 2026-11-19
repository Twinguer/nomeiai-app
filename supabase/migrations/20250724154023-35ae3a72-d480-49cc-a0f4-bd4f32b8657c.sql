-- Phase 1: Critical Database Security Fixes

-- 1. Enable RLS on unprotected tables
ALTER TABLE public.answer_key ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.answer_key_access_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.convocai ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_titles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.migration_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_answers_backup ENABLE ROW LEVEL SECURITY;

-- 2. Create RLS policies for answer_key (admin only)
CREATE POLICY "Only authenticated users can read answer keys"
ON public.answer_key
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Only system can modify answer keys"
ON public.answer_key
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 3. Create RLS policies for answer_key_access_log (user can see own logs)
CREATE POLICY "Users can view their own access logs"
ON public.answer_key_access_log
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "System can insert access logs"
ON public.answer_key_access_log
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- 4. Create RLS policies for job_titles (public read)
CREATE POLICY "Anyone can read job titles"
ON public.job_titles
FOR SELECT
USING (true);

CREATE POLICY "Only authenticated users can modify job titles"
ON public.job_titles
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 5. Create RLS policies for migration_logs (system only)
CREATE POLICY "Only system can access migration logs"
ON public.migration_logs
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 6. Create RLS policies for user_answers_backup (system only)
CREATE POLICY "Only system can access backup data"
ON public.user_answers_backup
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 7. Restrict convocai table (appears to be unused)
CREATE POLICY "Restrict convocai access"
ON public.convocai
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 8. Create user roles system for proper admin management
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 9. Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- 10. Create function to get current user role
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS app_role
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role 
  FROM public.user_roles 
  WHERE user_id = auth.uid() 
  ORDER BY 
    CASE role 
      WHEN 'admin' THEN 1 
      WHEN 'moderator' THEN 2 
      WHEN 'user' THEN 3 
    END 
  LIMIT 1
$$;

-- 11. RLS policies for user_roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all user roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 12. Fix existing database functions with search_path
CREATE OR REPLACE FUNCTION public.admin_delete_user_profile(user_id_param uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- Delete user followers relationships
  DELETE FROM user_followers 
  WHERE follower_id = user_id_param OR followed_id = user_id_param;
  
  -- Delete user answers from all rankings
  DELETE FROM user_answers
  WHERE user_ranking_id IN (
    SELECT id FROM user_rankings WHERE user_id = user_id_param
  );
  
  -- Delete user rankings
  DELETE FROM user_rankings WHERE user_id = user_id_param;
  
  -- Delete user profile
  DELETE FROM users_profiles WHERE id = user_id_param;
  
  -- Delete auth user
  DELETE FROM auth.users WHERE id = user_id_param;
  
  RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
  RETURN FALSE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_delete_user_from_ranking(ranking_id_param uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- Delete user answers for this ranking
  DELETE FROM user_answers WHERE user_ranking_id = ranking_id_param;
  
  -- Delete the user ranking entry
  DELETE FROM user_rankings WHERE id = ranking_id_param;
  
  RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
  RETURN FALSE;
END;
$function$;

-- 13. Add security logging table
CREATE TABLE public.security_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    action TEXT NOT NULL,
    details JSONB DEFAULT '{}',
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.security_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all security logs"
ON public.security_logs
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert security logs"
ON public.security_logs
FOR INSERT
TO authenticated
WITH CHECK (true);

-- 14. Add admin operation logging function
CREATE OR REPLACE FUNCTION public.log_admin_operation(
    operation_type TEXT,
    operation_details JSONB DEFAULT '{}'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO security_logs (user_id, action, details)
    VALUES (auth.uid(), operation_type, operation_details);
END;
$$;