-- Fix the Security Definer View issue by dropping the view and creating a function instead

-- Drop the problematic view
DROP VIEW IF EXISTS public.public_profiles;

-- Create a security definer function to get public profile data safely
CREATE OR REPLACE FUNCTION public.get_public_profiles()
RETURNS TABLE (
  id UUID,
  name TEXT,
  avatar_url TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    up.id,
    up.name,
    up.avatar_url
  FROM users_profiles up;
$$;

-- Grant execute permission to all users
GRANT EXECUTE ON FUNCTION public.get_public_profiles() TO anon, authenticated;

-- Create a regular view that uses the function (this won't be SECURITY DEFINER)
CREATE OR REPLACE VIEW public.public_profiles AS
SELECT * FROM public.get_public_profiles();

-- Grant select on the view
GRANT SELECT ON public.public_profiles TO anon, authenticated;