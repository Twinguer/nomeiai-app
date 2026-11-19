-- Followers public RPCs to bypass RLS via SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.get_followers_list(target_user_id uuid)
RETURNS TABLE(id uuid, name text, avatar_url text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT up.id, up.name, up.avatar_url
  FROM user_followers uf
  JOIN users_profiles up ON up.id = uf.follower_id
  WHERE uf.followed_id = target_user_id;
$$;

CREATE OR REPLACE FUNCTION public.get_following_list(target_user_id uuid)
RETURNS TABLE(id uuid, name text, avatar_url text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT up.id, up.name, up.avatar_url
  FROM user_followers uf
  JOIN users_profiles up ON up.id = uf.followed_id
  WHERE uf.follower_id = target_user_id;
$$;

-- Allow web clients to call these functions
GRANT EXECUTE ON FUNCTION public.get_followers_list(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_following_list(uuid) TO anon, authenticated;