-- Adicionar a coluna status_concurseiro na tabela users_profiles
ALTER TABLE public.users_profiles 
ADD COLUMN status_concurseiro TEXT DEFAULT 'Na Ativa';