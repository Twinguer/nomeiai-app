-- ============================================================
-- Restore nickname management (validation & update helpers)
-- Data: 2025-11-24
-- Objetivos:
--  1. Garantir que todos os perfis tenham nickname válido/único
--  2. Expor funções seguras para validar e atualizar o nickname
--  3. Exibir nickname em get_public_community_profiles
-- ============================================================

-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Função utilitária para normalizar nicknames
CREATE OR REPLACE FUNCTION public.normalize_nickname(p_input TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  sanitized TEXT;
BEGIN
  sanitized := LOWER(REGEXP_REPLACE(COALESCE(p_input, ''), '[^a-z0-9_]', '', 'g'));
  sanitized := SUBSTRING(sanitized, 1, 20);

  IF LENGTH(sanitized) < 3 THEN
    RETURN NULL;
  END IF;

  RETURN sanitized;
END;
$$;

-- Função para gerar nickname único baseado no nome/email
CREATE OR REPLACE FUNCTION public.generate_unique_nickname(base_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cleaned TEXT := COALESCE(public.normalize_nickname(base_name), 'user');
  candidate TEXT := cleaned;
  suffix INTEGER := 0;
BEGIN
  IF cleaned IS NULL OR cleaned = '' THEN
    cleaned := 'user';
    candidate := cleaned;
  END IF;

  LOOP
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.users_profiles WHERE nickname = candidate
    );

    suffix := suffix + 1;
    candidate := SUBSTRING(cleaned, 1, GREATEST(1, 20 - LENGTH(suffix::TEXT))) || suffix::TEXT;

    IF suffix >= 10000 THEN
      candidate := SUBSTRING(cleaned, 1, 12) || REPLACE(gen_random_uuid()::TEXT, '-', '');
      candidate := SUBSTRING(candidate, 1, 20);
    END IF;
  END LOOP;

  RETURN candidate;
END;
$$;

-- Garantir que todos os usuários possuam nickname válido
UPDATE public.users_profiles up
SET nickname = COALESCE(public.normalize_nickname(up.nickname), public.generate_unique_nickname(COALESCE(up.name, up.email)))
WHERE up.nickname IS NULL
  OR up.nickname = ''
  OR up.nickname !~ '^[a-z0-9_]{3,20}$';

-- Reforçar constraint NOT NULL
ALTER TABLE public.users_profiles
  ALTER COLUMN nickname SET NOT NULL;

ALTER TABLE public.users_profiles
  DROP CONSTRAINT IF EXISTS unique_nickname;
ALTER TABLE public.users_profiles
  ADD CONSTRAINT unique_nickname UNIQUE (nickname);

-- Garantir constraint de formato
ALTER TABLE public.users_profiles
  DROP CONSTRAINT IF EXISTS check_nickname_format;
ALTER TABLE public.users_profiles
  ADD CONSTRAINT check_nickname_format
  CHECK (
    nickname ~ '^[a-z0-9_]{3,20}$'
  );

-- Função para validar disponibilidade do nickname
CREATE OR REPLACE FUNCTION public.validate_nickname_availability(
  p_nickname TEXT,
  p_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_normalized TEXT;
  v_existing UUID;
BEGIN
  v_normalized := public.normalize_nickname(p_nickname);

  IF v_normalized IS NULL THEN
    RETURN jsonb_build_object(
      'is_valid', false,
      'reason', 'Nickname deve ter entre 3 e 20 caracteres, usando apenas letras minúsculas, números ou _.'
    );
  END IF;

  SELECT id INTO v_existing
  FROM public.users_profiles
  WHERE nickname = v_normalized
    AND (p_user_id IS NULL OR id <> p_user_id)
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'is_valid', false,
      'normalized', v_normalized,
      'reason', 'Nickname já está em uso.'
    );
  END IF;

  RETURN jsonb_build_object(
    'is_valid', true,
    'normalized', v_normalized
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_nickname_availability(TEXT, UUID) TO authenticated;

-- Função para atualizar nickname com verificação de autoria
CREATE OR REPLACE FUNCTION public.update_user_nickname(
  p_user_id UUID,
  p_nickname TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_requester UUID := auth.uid();
  v_target_nickname TEXT;
  v_existing UUID;
  v_profile RECORD;
BEGIN
  IF v_requester IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Contexto de autenticação não encontrado.');
  END IF;

  IF p_user_id IS NULL OR p_user_id <> v_requester THEN
    RETURN jsonb_build_object('success', false, 'error', 'Você só pode atualizar o seu próprio nickname.');
  END IF;

  SELECT id, name, email INTO v_profile
  FROM public.users_profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Perfil não encontrado.');
  END IF;

  IF p_nickname IS NULL OR TRIM(p_nickname) = '' THEN
    v_target_nickname := public.generate_unique_nickname(COALESCE(v_profile.name, v_profile.email));
  ELSE
    v_target_nickname := public.normalize_nickname(p_nickname);
    IF v_target_nickname IS NULL THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Nickname deve ter entre 3 e 20 caracteres, usando apenas letras minúsculas, números ou _.'
      );
    END IF;
  END IF;

  SELECT id INTO v_existing
  FROM public.users_profiles
  WHERE nickname = v_target_nickname
    AND id <> p_user_id
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Nickname já está em uso.');
  END IF;

  UPDATE public.users_profiles
  SET nickname = v_target_nickname,
      updated_at = NOW()
  WHERE id = p_user_id;

  RETURN jsonb_build_object('success', true, 'nickname', v_target_nickname);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_user_nickname(UUID, TEXT) TO authenticated;

-- Atualizar função pública para expor nickname
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
      COALESCE(up.is_studying, false) AS is_studying,
      (
        SELECT COUNT(*)::INT
        FROM regexp_split_to_table(COALESCE(NULLIF(up.concursos_aprovados, ''), ''), E'\n') AS linha(texto)
        WHERE length(trim(linha.texto)) > 0
      ) AS approval_count,
      (
        SELECT COUNT(*)::INT
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
    fp.nickname,
    fp.avatar_url,
    COALESCE(fp.bio, '') AS bio,
    fp.status_concurseiro,
    fp.is_studying,
    COALESCE(fp.approval_count, 0) AS approval_count,
    COALESCE(fp.ranking_count, 0) AS ranking_count,
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
'Retorna dados públicos sanitizados de usuários da comunidade, incluindo nickname único.';

