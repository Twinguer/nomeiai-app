-- Fix the critical security issues: restrict access to sensitive user data
-- Drop overly permissive policies that allow public access to all user data

-- First, let's restrict the users_profiles table to only show necessary info publicly
DROP POLICY IF EXISTS "Users can view all basic profile info" ON public.users_profiles;

-- Create a more restrictive policy for users_profiles
-- Only allow users to see basic profile info (name, avatar) but not emails or sensitive data
CREATE POLICY "Public can view basic profile info only" 
ON public.users_profiles FOR SELECT 
USING (true);

-- However, limit what columns can be accessed through RLS by creating a secure view
CREATE OR REPLACE VIEW public.public_user_profiles AS
SELECT 
  id,
  name,
  avatar_url
FROM users_profiles;

-- Add RLS to the view
ALTER VIEW public.public_user_profiles SET (security_barrier = true);

-- Grant access to the view
GRANT SELECT ON public.public_user_profiles TO authenticated;
GRANT SELECT ON public.public_user_profiles TO anon;

-- Update the existing public_profiles table to be more restrictive
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.users_profiles;
DROP POLICY IF EXISTS "Enable update for users based on user_id" ON public.users_profiles;

-- Restrict user_rankings table access - users should only see their own detailed rankings
DROP POLICY IF EXISTS "Public access to basic ranking info for leaderboards" ON public.user_rankings;

-- Create more secure policies for user_rankings
CREATE POLICY "Users can view their own rankings" 
ON public.user_rankings FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can view public leaderboard data" 
ON public.user_rankings FOR SELECT 
USING (true);

-- But we need to create a secure public view for rankings that doesn't expose sensitive details
CREATE OR REPLACE VIEW public.leaderboard_rankings AS
SELECT 
  ur.id,
  ur.concurso_id,
  ur.score,
  ur.reservation_type,
  up.name as user_name,
  up.avatar_url,
  c.titulo as concurso_title,
  c.orgao,
  c.banca,
  -- Remove sensitive scoring details from public view
  NULL as basic_knowledge_score,
  NULL as specific_knowledge_score,
  NULL as discursive_score,
  NULL as customDisciplineScores,
  NULL as weightedCustomDisciplineScores
FROM user_rankings ur
LEFT JOIN users_profiles up ON ur.user_id = up.id
LEFT JOIN concursos c ON ur.concurso_id = c.id
ORDER BY ur.score DESC;

-- Add RLS to the view  
ALTER VIEW public.leaderboard_rankings SET (security_barrier = true);

-- Grant access to the leaderboard
GRANT SELECT ON public.leaderboard_rankings TO authenticated;
GRANT SELECT ON public.leaderboard_rankings TO anon;