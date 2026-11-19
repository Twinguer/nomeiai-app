-- Allow dot character in nicknames

-- Atualizar função de normalização para aceitar ponto
CREATE OR REPLACE FUNCTION public.normalize_nickname(p_input TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  sanitized TEXT;
BEGIN
  sanitized := LOWER(REGEXP_REPLACE(COALESCE(p_input, ''), '[^a-z0-9_.]', '', 'g'));
  sanitized := SUBSTRING(sanitized, 1, 20);

  IF LENGTH(sanitized) < 3 THEN
    RETURN NULL;
  END IF;

  RETURN sanitized;
END;
$$;

-- Atualizar função de geração para usar novo normalizador
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

-- Atualizar função de validação para refletir o novo conjunto de caracteres
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
      'reason', 'Nickname deve ter entre 3 e 20 caracteres, usando letras minúsculas, números, underscore ou ponto.'
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

-- Atualizar mensagens de erro da função update_user_nickname
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
        'error', 'Nickname deve ter entre 3 e 20 caracteres, usando letras minúsculas, números, underscore ou ponto.'
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

-- Atualizar constraint para aceitar o ponto
ALTER TABLE public.users_profiles
  DROP CONSTRAINT IF EXISTS check_nickname_format;
ALTER TABLE public.users_profiles
  ADD CONSTRAINT check_nickname_format
  CHECK (
    nickname ~ '^[a-z0-9_.]{3,20}$'
  );

