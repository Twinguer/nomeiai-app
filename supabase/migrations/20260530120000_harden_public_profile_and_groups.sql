-- Endurece perfil público (privacidade no servidor), grupos públicos sempre visíveis,
-- restringe get_user_groups e corrige policy de update em concursos.

BEGIN;

-- ---------------------------------------------------------------------------
-- Helper: flags de privacidade do perfil (espelha parseProfilePrivacySettings)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.profile_privacy_flag(
  p_settings jsonb,
  p_key text
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_settings IS NULL OR jsonb_typeof(p_settings) <> 'object' THEN false
    WHEN (p_settings -> p_key) = 'true'::jsonb THEN true
    ELSE false
  END;
$$;

-- ---------------------------------------------------------------------------
-- Perfil público com privacidade aplicada no servidor
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_public_user_profile_secure(p_user_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row users_profiles%ROWTYPE;
  v_privacy jsonb;
  v_show_about boolean;
  v_show_rankings boolean;
  v_rankings_count integer := 0;
  v_is_coach boolean := false;
  v_data jsonb;
BEGIN
  SELECT *
  INTO v_row
  FROM users_profiles
  WHERE id = p_user_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Perfil não encontrado');
  END IF;

  v_privacy := COALESCE(v_row.privacy_settings, '{}'::jsonb);
  v_show_about := public.profile_privacy_flag(v_privacy, 'showPublicAboutInfo');
  v_show_rankings := public.profile_privacy_flag(v_privacy, 'showPublicRankings');

  IF v_show_rankings THEN
    SELECT COUNT(*)
    INTO v_rankings_count
    FROM user_rankings ur
    WHERE ur.user_id = p_user_id
      AND ur.consolidated_data IS NOT NULL
      AND ur.consolidated_data ? 'rankings'
      AND ur.consolidated_data->'rankings' <> '{}'::jsonb;
  END IF;

  BEGIN
    v_is_coach := public.is_user_coach(p_user_id);
  EXCEPTION
    WHEN OTHERS THEN
      v_is_coach := false;
  END;

  v_data := jsonb_build_object(
    'id', v_row.id,
    'name', v_row.name,
    'avatar_url', v_row.avatar_url,
    'nickname', v_row.nickname,
    'profile_text', v_row.profile_text,
    'is_coach', COALESCE(v_is_coach, false),
    'rankings_count', v_rankings_count,
    'privacy', jsonb_build_object(
      'showPublicRankings', public.profile_privacy_flag(v_privacy, 'showPublicRankings'),
      'showPublicStudyStats', public.profile_privacy_flag(v_privacy, 'showPublicStudyStats'),
      'showPublicRankingPosition', public.profile_privacy_flag(v_privacy, 'showPublicRankingPosition'),
      'showPublicAboutInfo', v_show_about
    )
  );

  IF v_show_about THEN
    v_data := v_data || jsonb_build_object(
      'estado', v_row.estado,
      'formacao', v_row.formacao,
      'cargo_atual', v_row.cargo_atual,
      'area_estudos', v_row.area_estudos,
      'especialidade', v_row.especialidade,
      'curso_preparatorio', v_row.curso_preparatorio,
      'rotina_estudos', v_row.rotina_estudos,
      'concursos_aprovados', v_row.concursos_aprovados,
      'concursos_participando', v_row.concursos_participando,
      'status_concurseiro', v_row.status_concurseiro
    );
  END IF;

  RETURN jsonb_build_object('success', true, 'data', v_data);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

COMMENT ON FUNCTION public.get_public_user_profile_secure(UUID) IS
'Perfil público sanitizado. Campos de sobre mim/rotina só quando showPublicAboutInfo=true.';

GRANT EXECUTE ON FUNCTION public.get_public_user_profile_secure(UUID) TO authenticated, anon;

-- ---------------------------------------------------------------------------
-- Rankings resumidos para perfil público (sem consolidated_data completo)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_public_profile_ranking_summaries(p_user_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_privacy jsonb;
  v_show_rankings boolean;
  v_consolidated jsonb;
  v_items jsonb := '[]'::jsonb;
  v_key text;
  v_entry jsonb;
  v_concurso_id uuid;
  v_score numeric;
  v_title text;
BEGIN
  SELECT privacy_settings
  INTO v_privacy
  FROM users_profiles
  WHERE id = p_user_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Perfil não encontrado');
  END IF;

  SELECT consolidated_data
  INTO v_consolidated
  FROM user_rankings
  WHERE user_id = p_user_id
  LIMIT 1;

  v_consolidated := COALESCE(v_consolidated, '{}'::jsonb);

  v_show_rankings := public.profile_privacy_flag(COALESCE(v_privacy, '{}'::jsonb), 'showPublicRankings');

  IF NOT v_show_rankings THEN
    RETURN jsonb_build_object('success', true, 'data', '[]'::jsonb);
  END IF;

  IF v_consolidated IS NULL
     OR NOT (v_consolidated ? 'rankings')
     OR v_consolidated->'rankings' = '{}'::jsonb THEN
    RETURN jsonb_build_object('success', true, 'data', '[]'::jsonb);
  END IF;

  FOR v_key, v_entry IN
    SELECT key, value
    FROM jsonb_each(v_consolidated->'rankings')
  LOOP
    BEGIN
      v_concurso_id := (v_entry->>'concurso_id')::uuid;
    EXCEPTION
      WHEN OTHERS THEN
        CONTINUE;
    END;

    IF v_concurso_id IS NULL THEN
      CONTINUE;
    END IF;

    v_score := COALESCE((v_entry->'user_data'->>'score')::numeric, 0);

    SELECT c.titulo
    INTO v_title
    FROM concursos c
    WHERE c.id = v_concurso_id
    LIMIT 1;

    v_items := v_items || jsonb_build_array(
      jsonb_build_object(
        'concurso_id', v_concurso_id,
        'concurso_title', COALESCE(v_title, 'Concurso sem título'),
        'score', v_score
      )
    );
  END LOOP;

  RETURN jsonb_build_object('success', true, 'data', v_items);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

COMMENT ON FUNCTION public.get_public_profile_ranking_summaries(UUID) IS
'Resumo de rankings para perfil público. Respeita showPublicRankings; não expõe consolidated_data.';

GRANT EXECUTE ON FUNCTION public.get_public_profile_ranking_summaries(UUID) TO authenticated, anon;

-- ---------------------------------------------------------------------------
-- Grupos públicos do usuário — sempre visíveis no perfil público
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_public_groups(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  cover_image_url TEXT,
  members_count INTEGER,
  privacy_level TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    sg.id,
    sg.name,
    sg.cover_image_url,
    COALESCE(sg.current_members, 0)::integer AS members_count,
    sg.privacy_level
  FROM study_group_members sgm
  JOIN study_groups sg ON sg.id = sgm.group_id
  WHERE sgm.user_id = p_user_id
    AND sgm.status = 'active'
    AND COALESCE(sg.archived, false) = false
    AND sg.privacy_level = 'public'
  ORDER BY sgm.joined_at DESC;
$$;

COMMENT ON FUNCTION public.get_user_public_groups(UUID) IS
'Grupos públicos em que o usuário participa. Visíveis para qualquer visitante do perfil.';

GRANT EXECUTE ON FUNCTION public.get_user_public_groups(UUID) TO authenticated, anon;

-- ---------------------------------------------------------------------------
-- get_user_groups: apenas o próprio usuário ou admin da plataforma
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_user_groups(UUID);

CREATE FUNCTION public.get_user_groups(p_user_id UUID)
RETURNS TABLE(
  id UUID,
  name TEXT,
  description TEXT,
  cover_image_url TEXT,
  privacy_level TEXT,
  max_members INTEGER,
  current_members INTEGER,
  focus_area TEXT,
  target_concurso_id UUID,
  coach_id UUID,
  created_by UUID,
  posts_data JSONB,
  group_settings JSONB,
  post_retention_days INTEGER,
  archived BOOLEAN,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  role TEXT,
  joined_at TIMESTAMP
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF auth.uid() IS DISTINCT FROM p_user_id
     AND NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT
    sg.id,
    sg.name,
    sg.description,
    sg.cover_image_url,
    sg.privacy_level,
    sg.max_members,
    sg.current_members,
    sg.focus_area,
    sg.target_concurso_id,
    sg.coach_id,
    sg.created_by,
    COALESCE(sg.posts_data, '[]'::jsonb) AS posts_data,
    COALESCE(sg.group_settings, '{}'::jsonb) AS group_settings,
    sg.post_retention_days,
    sg.archived,
    sg.created_at,
    sg.updated_at,
    sgm.role,
    sgm.joined_at
  FROM study_group_members sgm
  JOIN study_groups sg ON sg.id = sgm.group_id
  WHERE sgm.user_id = p_user_id
    AND sgm.status = 'active'
    AND COALESCE(sg.archived, false) = false
  ORDER BY sgm.joined_at DESC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_user_groups(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_user_groups(UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- concursos: policy de update usa created_by_user_id (schema real)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can update their own concursos" ON public.concursos;
DROP POLICY IF EXISTS "Users can delete their own concursos" ON public.concursos;

CREATE POLICY "Users can update their own concursos"
  ON public.concursos FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = created_by_user_id
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  )
  WITH CHECK (
    auth.uid() = created_by_user_id
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

CREATE POLICY "Users can delete their own concursos"
  ON public.concursos FOR DELETE
  TO authenticated
  USING (
    auth.uid() = created_by_user_id
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

COMMIT;
