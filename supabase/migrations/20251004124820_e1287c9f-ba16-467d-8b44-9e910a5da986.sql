-- Create missing user profiles for users registered before trigger was implemented
INSERT INTO public.users_profiles (id, email, name, created_at, updated_at)
SELECT 
  id,
  email,
  COALESCE(raw_user_meta_data->>'name', split_part(email, '@', 1)) as name,
  created_at,
  now()
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.users_profiles)
ON CONFLICT (id) DO NOTHING;