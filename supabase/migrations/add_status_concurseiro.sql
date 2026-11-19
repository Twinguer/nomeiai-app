
-- Add status_concurseiro column to users_profiles table
ALTER TABLE IF EXISTS public.users_profiles 
ADD COLUMN IF NOT EXISTS status_concurseiro text DEFAULT 'Na Ativa';
