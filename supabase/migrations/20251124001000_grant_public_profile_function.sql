-- Grant access to updated get_public_community_profiles function
GRANT EXECUTE ON FUNCTION public.get_public_community_profiles(TEXT, INTEGER, INTEGER)
  TO authenticated, anon;

COMMENT ON FUNCTION public.get_public_community_profiles(TEXT, INTEGER, INTEGER)
  IS 'Retorna dados públicos sanitizados de usuários da comunidade, incluindo nickname único.';


