
-- This file ensures that the status_concurseiro migration is executed
-- by explicitly running the migration that's in add_status_concurseiro.sql

-- Add status_concurseiro column to users_profiles table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'users_profiles' 
    AND column_name = 'status_concurseiro'
  ) THEN
    ALTER TABLE IF EXISTS public.users_profiles 
    ADD COLUMN status_concurseiro text DEFAULT 'Na Ativa';
  END IF;
END $$;
