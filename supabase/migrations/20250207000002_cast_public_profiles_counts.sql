-- ============================================================================
-- HOTFIX 2: corrigir tipos numéricos em get_public_community_profiles
-- DATA: 2025-02-07
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_public_community_profiles(
  p_search TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 100,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  avatar_url TEXT,
  bio TEXT,
  status_concurseiro TEXT,
  is_studying BOOLEAN,
  approval_count INTEGER,
  ranking_count INTEGER,
  is_coach BOOLEAN,
  is_pro BOOLEAN,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit INTEGER := COALESCE(NULLIF(p_limit, 0), 100);
  v_offset INTEGER := GREATEST(COALESCE(p_offset, 0), 0);
BEGIN
  IF v_limit < 0 THEN
    v_limit := 100;
  ELSIF v_limit > 200 THEN
    v_limit := 200;
  END IF;

  PERFORM set_config('row_security', 'off', true);

  RETURN QUERY
  WITH filtered_profiles AS (
    SELECT
      up.id AS profile_id,
      up.name,
      up.avatar_url,
      LEFT(COALESCE(up.bio, ''), 280) AS bio,
      up.status_concurseiro,
      COALESCE(up.is_studying, false) AS is_studying,
      (
        SELECT COUNT(*)::integer
        FROM regexp_split_to_table(COALESCE(NULLIF(up.concursos_aprovados, ''), ''), E'\n') AS linha(texto)
        WHERE length(trim(linha.texto)) > 0
      ) AS approval_count,
      (
        SELECT COUNT(*)::integer
        FROM jsonb_object_keys(COALESCE(ur.consolidated_data->'rankings', '{}'::jsonb))
      ) AS ranking_count,
      public.is_user_coach(up.id) AS is_coach,
      public.is_user_pro(up.id) AS is_pro,
      up.created_at
    FROM public.users_profiles up
    LEFT JOIN public.user_rankings ur ON ur.user_id = up.id
    WHERE (
      p_search IS NULL
      OR up.name ILIKE '%' || p_search || '%'
      OR up.nickname ILIKE '%' || p_search || '%'
    )
    ORDER BY up.created_at DESC
    OFFSET v_offset
    LIMIT v_limit
  )
  SELECT
    fp.profile_id AS id,
    fp.name,
    fp.avatar_url,
    COALESCE(fp.bio, '') AS bio,
    fp.status_concurseiro,
    fp.is_studying,
    COALESCE(fp.approval_count, 0)::integer AS approval_count,
    COALESCE(fp.ranking_count, 0)::integer AS ranking_count,
    COALESCE(fp.is_coach, false) AS is_coach,
    COALESCE(fp.is_pro, false) AS is_pro,
    fp.created_at
  FROM filtered_profiles fp;

  PERFORM set_config('row_security', 'on', true);
EXCEPTION
  WHEN OTHERS THEN
    PERFORM set_config('row_security', 'on', true);
    RAISE;
END;
$$;

COMMENT ON FUNCTION public.get_public_community_profiles(TEXT, INTEGER, INTEGER) IS
'Retorna dados públicos sanitizados de usuários da comunidade, respeitando limites e evitando exposição de campos sensíveis.';


