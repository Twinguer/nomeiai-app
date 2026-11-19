-- Comunidade: is_studying só conta sessões recentes (evita flags stale no banco).
-- O cliente renova study_started_at via heartbeat enquanto o timer está ativo.

UPDATE public.users_profiles
SET
  is_studying = false,
  study_started_at = NULL
WHERE is_studying = true
  AND (
    study_started_at IS NULL
    OR study_started_at < (now() - interval '10 minutes')
  );

DROP FUNCTION IF EXISTS public.get_public_community_profiles(TEXT, INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION public.get_public_community_profiles(
  p_search TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 100,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  nickname TEXT,
  avatar_url TEXT,
  bio TEXT,
  status_concurseiro TEXT,
  is_studying BOOLEAN,
  approval_count INTEGER,
  ranking_count INTEGER,
  is_coach BOOLEAN,
  is_pro BOOLEAN,
  has_active_coach BOOLEAN,
  active_student_count INTEGER,
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
      up.nickname,
      up.avatar_url,
      LEFT(COALESCE(up.bio, ''), 280) AS bio,
      up.status_concurseiro,
      (
        COALESCE(up.is_studying, false)
        AND up.study_started_at IS NOT NULL
        AND up.study_started_at > (now() - interval '10 minutes')
      ) AS is_studying,
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
      public.is_user_pro(up.id) AS is_pro_plan,
      EXISTS (
        SELECT 1
        FROM public.coach_profiles cp
        CROSS JOIN LATERAL jsonb_array_elements(
          CASE
            WHEN jsonb_typeof(cp.student_relationships) = 'array' THEN cp.student_relationships
            ELSE '[]'::jsonb
          END
        ) AS rel(value)
        WHERE (rel.value->>'student_id')::uuid = up.id
          AND COALESCE(NULLIF(trim(rel.value->>'status'), ''), 'active') = 'active'
      ) AS has_active_coach,
      COALESCE(
        (
          SELECT COUNT(*)::integer
          FROM public.coach_profiles cp
          CROSS JOIN LATERAL jsonb_array_elements(
            CASE
              WHEN jsonb_typeof(cp.student_relationships) = 'array' THEN cp.student_relationships
              ELSE '[]'::jsonb
            END
          ) AS rel(value)
          WHERE cp.coach_id = up.id
            AND COALESCE(NULLIF(trim(rel.value->>'status'), ''), 'active') = 'active'
        ),
        0
      )::integer AS active_student_count,
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
    fp.nickname,
    fp.avatar_url,
    COALESCE(fp.bio, '') AS bio,
    fp.status_concurseiro,
    fp.is_studying,
    COALESCE(fp.approval_count, 0)::integer AS approval_count,
    COALESCE(fp.ranking_count, 0)::integer AS ranking_count,
    COALESCE(fp.is_coach, false) AS is_coach,
    (
      COALESCE(fp.is_coach, false)
      OR COALESCE(fp.has_active_coach, false)
      OR COALESCE(fp.is_pro_plan, false)
    ) AS is_pro,
    COALESCE(fp.has_active_coach, false) AS has_active_coach,
    COALESCE(fp.active_student_count, 0)::integer AS active_student_count,
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
  'Perfis públicos da comunidade. is_studying exige flag ativa e study_started_at nos últimos 10 minutos.';

GRANT EXECUTE ON FUNCTION public.get_public_community_profiles(TEXT, INTEGER, INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_community_profiles(TEXT, INTEGER, INTEGER) TO authenticated;
