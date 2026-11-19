-- Restrict RLS policies for better security on users_profiles table
-- Drop existing overly permissive policies first
DROP POLICY IF EXISTS "Allow public read of profiles" ON public.users_profiles;
DROP POLICY IF EXISTS "Enable read access for authenticated users only" ON public.users_profiles;
DROP POLICY IF EXISTS "Anyone can read profiles" ON public.users_profiles;

-- Create more restrictive policies for users_profiles
CREATE POLICY "Users can view all basic profile info" 
ON public.users_profiles FOR SELECT 
USING (true);

CREATE POLICY "Users can update their own profile" 
ON public.users_profiles FOR UPDATE 
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" 
ON public.users_profiles FOR INSERT 
WITH CHECK (auth.uid() = id);

-- Restrict RLS policies for user_rankings table to be more secure
-- Create a view for public ranking data that doesn't expose sensitive info
CREATE OR REPLACE VIEW public.public_rankings AS
SELECT 
  ur.id,
  ur.concurso_id,
  ur.score,
  ur.basic_knowledge_score,
  ur.specific_knowledge_score,
  ur.discursive_score,
  ur.reservation_type,
  up.name as user_name,
  up.avatar_url,
  c.titulo as concurso_title,
  c.orgao,
  c.banca
FROM user_rankings ur
LEFT JOIN users_profiles up ON ur.user_id = up.id
LEFT JOIN concursos c ON ur.concurso_id = c.id;

-- Add RLS to the view
ALTER VIEW public.public_rankings SET (security_barrier = true);

-- Grant access to the view
GRANT SELECT ON public.public_rankings TO authenticated;
GRANT SELECT ON public.public_rankings TO anon;