-- Fix restrictive RLS policies to allow public access to profiles and rankings
-- This migration corrects overly restrictive policies that prevent users from accessing public profiles and leaderboards

-- 1. Fix users_profiles table policies
-- Drop overly restrictive policies
DROP POLICY IF EXISTS "secure_users_can_view_own_profile" ON public.users_profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users_profiles;
DROP POLICY IF EXISTS "Public can view basic profile info only" ON public.users_profiles;

-- Create permissive policy for public profile access
CREATE POLICY "Public can view all profile info" 
ON public.users_profiles FOR SELECT 
USING (true);

-- Keep restrictive policies for updates/inserts
CREATE POLICY "Users can update their own profile"
ON public.users_profiles
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
ON public.users_profiles
FOR INSERT
WITH CHECK (auth.uid() = id);

-- 2. Fix user_rankings table policies
-- Drop overly restrictive policies
DROP POLICY IF EXISTS "Users can view their own rankings" ON public.user_rankings;
DROP POLICY IF EXISTS "Public access to basic ranking info for leaderboards" ON public.user_rankings;

-- Create permissive policy for public ranking access
CREATE POLICY "Public can view all ranking data" 
ON public.user_rankings FOR SELECT 
USING (true);

-- Keep restrictive policies for updates/inserts
CREATE POLICY "Users can update their own rankings"
ON public.user_rankings
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can insert their own rankings"
ON public.user_rankings
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- 3. Create comprehensive public views for better performance
-- Drop existing limited views
DROP VIEW IF EXISTS public.public_profiles;
DROP VIEW IF EXISTS public.public_user_profiles;
DROP VIEW IF EXISTS public.public_rankings;
DROP VIEW IF EXISTS public.leaderboard_rankings;

-- Create comprehensive public profiles view
CREATE OR REPLACE VIEW public.public_profiles AS
SELECT 
  id,
  name,
  avatar_url,
  created_at,
  updated_at
FROM public.users_profiles;

-- Grant public access to the view
GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- Create comprehensive public rankings view
CREATE OR REPLACE VIEW public.public_rankings AS
SELECT 
  ur.id,
  ur.user_id,
  ur.concurso_id,
  ur.score,
  ur.basic_knowledge_score,
  ur.specific_knowledge_score,
  ur.discursive_score,
  ur.reservation_type,
  ur.created_at,
  ur.updated_at,
  up.name as user_name,
  up.avatar_url,
  c.titulo as concurso_title,
  c.orgao,
  c.banca
FROM public.user_rankings ur
LEFT JOIN public.users_profiles up ON ur.user_id = up.id
LEFT JOIN public.concursos c ON ur.concurso_id = c.id;

-- Grant public access to the view
GRANT SELECT ON public.public_rankings TO anon, authenticated;

-- 4. Create public leaderboard view for better performance
CREATE OR REPLACE VIEW public.leaderboard_rankings AS
SELECT 
  ur.id,
  ur.user_id,
  ur.concurso_id,
  ur.score,
  ur.reservation_type,
  up.name as user_name,
  up.avatar_url,
  c.titulo as concurso_title,
  c.orgao,
  c.banca,
  ROW_NUMBER() OVER (PARTITION BY ur.concurso_id, ur.reservation_type ORDER BY ur.score DESC) as position
FROM public.user_rankings ur
LEFT JOIN public.users_profiles up ON ur.user_id = up.id
LEFT JOIN public.concursos c ON ur.concurso_id = c.id;

-- Grant public access to the view
GRANT SELECT ON public.leaderboard_rankings TO anon, authenticated;

-- 5. Log the security policy update
INSERT INTO security_logs (user_id, action, details)
VALUES (
  NULL, 
  'security_policy_update', 
  jsonb_build_object(
    'table', 'users_profiles,user_rankings',
    'action', 'fixed_restrictive_policies',
    'description', 'Fixed overly restrictive RLS policies to allow public access to profiles and rankings',
    'timestamp', now()
  )
);
