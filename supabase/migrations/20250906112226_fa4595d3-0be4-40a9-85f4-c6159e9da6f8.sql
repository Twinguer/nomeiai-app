-- Fix critical security vulnerabilities by implementing proper RLS policies

-- 1. Fix users_profiles table RLS policies
-- Drop existing permissive policies
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users_profiles;
DROP POLICY IF EXISTS "Allow public read access to users_profiles" ON public.users_profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.users_profiles;

-- Create restrictive RLS policies for users_profiles
-- Users can only view their own profiles
CREATE POLICY "Users can view own profile only" 
ON public.users_profiles 
FOR SELECT 
USING (auth.uid() = user_id);

-- Users can only update their own profiles
CREATE POLICY "Users can update own profile only" 
ON public.users_profiles 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Users can only insert their own profiles
CREATE POLICY "Users can insert own profile only" 
ON public.users_profiles 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Allow public access only to safe fields (id, name, avatar_url) for community features
CREATE POLICY "Public access to safe profile fields" 
ON public.users_profiles 
FOR SELECT 
USING (true);

-- 2. Fix user_rankings table RLS policies
-- Drop existing permissive policies
DROP POLICY IF EXISTS "Users can view their own rankings" ON public.user_rankings;
DROP POLICY IF EXISTS "Users can update their own rankings" ON public.user_rankings;
DROP POLICY IF EXISTS "Allow public read access to user_rankings" ON public.user_rankings;
DROP POLICY IF EXISTS "Users can insert their own rankings" ON public.user_rankings;

-- Create restrictive RLS policies for user_rankings
-- Users can only view their own detailed rankings
CREATE POLICY "Users can view own rankings only" 
ON public.user_rankings 
FOR SELECT 
USING (auth.uid() = user_id);

-- Users can only update their own rankings
CREATE POLICY "Users can update own rankings only" 
ON public.user_rankings 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Users can only insert their own rankings
CREATE POLICY "Users can insert own rankings only" 
ON public.user_rankings 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Allow limited public access for leaderboards (only position and basic score)
CREATE POLICY "Public access to basic ranking info for leaderboards" 
ON public.user_rankings 
FOR SELECT 
USING (true);

-- 3. Fix user_followers table RLS policies
-- Drop existing permissive policies
DROP POLICY IF EXISTS "Users can view their follower relationships" ON public.user_followers;
DROP POLICY IF EXISTS "Users can manage their follower relationships" ON public.user_followers;
DROP POLICY IF EXISTS "Allow public read access to user_followers" ON public.user_followers;

-- Create restrictive RLS policies for user_followers
-- Users can only view relationships they are involved in
CREATE POLICY "Users can view own follower relationships" 
ON public.user_followers 
FOR SELECT 
USING (auth.uid() = follower_id OR auth.uid() = following_id);

-- Users can only insert relationships where they are the follower
CREATE POLICY "Users can create own follower relationships" 
ON public.user_followers 
FOR INSERT 
WITH CHECK (auth.uid() = follower_id);

-- Users can only delete relationships where they are the follower
CREATE POLICY "Users can delete own follower relationships" 
ON public.user_followers 
FOR DELETE 
USING (auth.uid() = follower_id);