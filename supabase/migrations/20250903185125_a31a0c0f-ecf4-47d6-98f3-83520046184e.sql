-- Security Fix: Restrict users_profiles access and create public view

-- Drop existing permissive policies
DROP POLICY IF EXISTS "Allow public read of user profiles" ON public.users_profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.users_profiles;
DROP POLICY IF EXISTS "Users can view all profiles" ON public.users_profiles;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.users_profiles;

-- Create restrictive RLS policies for users_profiles
CREATE POLICY "Users can view their own profile"
ON public.users_profiles
FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
ON public.users_profiles
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
ON public.users_profiles
FOR INSERT
WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
ON public.users_profiles
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create public view with only safe fields for public displays
CREATE OR REPLACE VIEW public.public_profiles AS
SELECT 
  id,
  name,
  avatar_url
FROM public.users_profiles;

-- Grant public access to the view
GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- Create RLS policy for the view (allow public read)
ALTER VIEW public.public_profiles OWNER TO postgres;

-- Log the security improvement
INSERT INTO security_logs (user_id, action, details)
VALUES (
  NULL, 
  'security_policy_update', 
  jsonb_build_object(
    'table', 'users_profiles',
    'action', 'restricted_public_access',
    'description', 'Implemented secure RLS policies and created public view for safe profile data',
    'timestamp', now()
  )
);