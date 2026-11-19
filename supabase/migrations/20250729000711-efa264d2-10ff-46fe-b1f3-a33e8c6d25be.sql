-- Add studying status to users_profiles table
ALTER TABLE public.users_profiles 
ADD COLUMN is_studying BOOLEAN DEFAULT false,
ADD COLUMN study_started_at TIMESTAMP WITH TIME ZONE;

-- Create an index for better performance when querying studying users
CREATE INDEX idx_users_profiles_studying ON public.users_profiles(is_studying) WHERE is_studying = true;

-- Enable realtime for users_profiles table to sync studying status
ALTER TABLE public.users_profiles REPLICA IDENTITY FULL;