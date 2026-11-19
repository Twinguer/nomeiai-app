-- Validação de anexos, membership em grupos privados e rate limiting em posts/comentários.

CREATE OR REPLACE FUNCTION public.assert_group_content_rate_limit(
  p_action TEXT,
  p_group_id UUID,
  p_max_requests INTEGER,
  p_time_window_seconds INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_check JSONB;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'error', 'Autenticação necessária');
  END IF;

  v_check := public.check_rate_limit(
    auth.uid(),
    p_action,
    p_max_requests,
    p_time_window_seconds
  );

  IF COALESCE((v_check->>'allowed')::boolean, false) IS NOT TRUE THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'error', 'Limite de ações atingido. Tente novamente em alguns minutos.',
      'retry_after', COALESCE((v_check->>'retry_after')::integer, p_time_window_seconds)
    );
  END IF;

  INSERT INTO public.audit_logs (
    user_id,
    action,
    resource_type,
    resource_id,
    severity,
    status,
    metadata
  ) VALUES (
    auth.uid(),
    p_action,
    'study_groups',
    p_group_id,
    'low',
    'success',
    jsonb_build_object(
      'rate_limit_window_seconds', p_time_window_seconds,
      'max_requests', p_max_requests
    )
  );

  RETURN jsonb_build_object('allowed', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_group_post_attachments(
  p_group_id UUID,
  p_attachments JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_attachment JSONB;
  v_url TEXT;
  v_url_path TEXT;
  v_type TEXT;
  v_name TEXT;
  v_required_prefix TEXT;
  v_object_path TEXT;
  v_idx INTEGER := 0;
BEGIN
  IF p_attachments IS NULL OR jsonb_typeof(p_attachments) <> 'array' THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Formato de anexos inválido');
  END IF;

  IF jsonb_array_length(p_attachments) = 0 THEN
    RETURN jsonb_build_object('valid', true);
  END IF;

  IF jsonb_array_length(p_attachments) > 5 THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Máximo de 5 anexos por post');
  END IF;

  v_required_prefix := '/storage/v1/object/public/profiles/group-posts/' || p_group_id::text || '/';

  FOR v_attachment IN
    SELECT value
    FROM jsonb_array_elements(p_attachments) AS value
  LOOP
    v_idx := v_idx + 1;

    IF jsonb_typeof(v_attachment) <> 'object' THEN
      RETURN jsonb_build_object('valid', false, 'error', 'Anexo inválido na posição ' || v_idx);
    END IF;

    v_url := btrim(COALESCE(v_attachment->>'url', ''));
    v_type := lower(btrim(COALESCE(v_attachment->>'type', '')));
    v_name := btrim(COALESCE(v_attachment->>'name', ''));

    IF v_url = '' OR v_type = '' OR v_name = '' THEN
      RETURN jsonb_build_object('valid', false, 'error', 'Anexo incompleto na posição ' || v_idx);
    END IF;

    IF v_type NOT IN ('image', 'pdf') THEN
      RETURN jsonb_build_object('valid', false, 'error', 'Tipo de anexo não permitido');
    END IF;

    IF char_length(v_name) > 255 OR v_name ~ '[[:cntrl:]]' THEN
      RETURN jsonb_build_object('valid', false, 'error', 'Nome de anexo inválido');
    END IF;

    IF v_url !~* '^https://[a-z0-9-]+\.supabase\.co/storage/v1/object/public/profiles/group-posts/' THEN
      RETURN jsonb_build_object('valid', false, 'error', 'URL de anexo deve usar o storage autorizado');
    END IF;

    IF v_url ~* '(javascript:|data:|file:|blob:)' OR position('..' IN v_url) > 0 THEN
      RETURN jsonb_build_object('valid', false, 'error', 'URL de anexo inválida');
    END IF;

    v_url_path := split_part(regexp_replace(v_url, '^https://[^/]+', ''), '?', 1);

    IF v_url_path NOT LIKE v_required_prefix || '%' THEN
      RETURN jsonb_build_object(
        'valid', false,
        'error', 'URL de anexo deve pertencer ao grupo e ao bucket profiles/group-posts'
      );
    END IF;

    v_object_path := substring(v_url_path FROM char_length(v_required_prefix) + 1);

    IF v_object_path = '' OR v_object_path ~ '/' OR v_object_path ~ '[[:cntrl:]]' THEN
      RETURN jsonb_build_object('valid', false, 'error', 'Caminho de anexo inválido para este grupo');
    END IF;
  END LOOP;

  RETURN jsonb_build_object('valid', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.can_view_group_feed(
  p_group_id UUID,
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_privacy_level TEXT;
  v_user_plan subscription_plan;
  v_is_coach BOOLEAN;
  v_is_member BOOLEAN;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'error', 'Autenticação necessária para visualizar grupos.');
  END IF;

  SELECT sg.privacy_level
  INTO v_privacy_level
  FROM public.study_groups sg
  WHERE sg.id = p_group_id
    AND sg.archived = false;

  IF v_privacy_level IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'error', 'Grupo não encontrado');
  END IF;

  v_user_plan := public.get_user_subscription_plan(p_user_id);
  IF v_user_plan IS NULL THEN
    v_user_plan := 'free'::subscription_plan;
  END IF;

  v_is_coach := public.is_user_coach(p_user_id);

  IF v_user_plan = 'free'::subscription_plan AND NOT v_is_coach THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'error', 'Grupos de estudos estão disponíveis apenas no plano Pro ou Modo Coach.',
      'requires_upgrade', true
    );
  END IF;

  IF public.has_role(p_user_id, 'admin'::app_role) THEN
    RETURN jsonb_build_object('allowed', true);
  END IF;

  IF v_privacy_level = 'public' THEN
    RETURN jsonb_build_object('allowed', true);
  END IF;

  v_is_member := public.user_is_group_member(p_group_id, p_user_id);

  IF NOT v_is_member THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'error', 'Acesso negado ao conteúdo do grupo'
    );
  END IF;

  RETURN jsonb_build_object('allowed', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_group_feed(
  p_group_id UUID,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_access JSONB;
  v_enriched_posts JSONB;
BEGIN
  v_access := public.can_view_group_feed(p_group_id, auth.uid());

  IF COALESCE((v_access->>'allowed')::boolean, false) IS NOT TRUE THEN
    RETURN jsonb_build_object(
      'error', COALESCE(v_access->>'error', 'Acesso negado ao conteúdo do grupo'),
      'requires_upgrade', COALESCE((v_access->>'requires_upgrade')::boolean, false)
    );
  END IF;

  WITH filtered_posts AS (
    SELECT
      value AS post_data,
      (value->>'author_id')::uuid AS post_author_id
    FROM public.study_groups,
    jsonb_array_elements(COALESCE(posts_data, '[]'::jsonb)) AS value
    WHERE study_groups.id = p_group_id
      AND COALESCE((value->>'is_deleted')::boolean, false) = false
      AND (value->>'expires_at')::timestamp > NOW()
    ORDER BY
      CASE WHEN COALESCE((value->>'is_pinned')::boolean, false) THEN 0 ELSE 1 END,
      (value->>'created_at')::timestamp DESC
    LIMIT p_limit
    OFFSET p_offset
  )
  SELECT jsonb_agg(
    fp.post_data
      || jsonb_build_object(
        'author_name', COALESCE(post_author.name, 'Usuário'),
        'author_avatar', post_author.avatar_url
      )
      || jsonb_build_object(
        'comments', COALESCE(
          (
            SELECT jsonb_agg(
              comment_elem
                || jsonb_build_object(
                  'author_name', COALESCE(comment_author.name, 'Usuário'),
                  'author_avatar', comment_author.avatar_url
                )
            )
            FROM jsonb_array_elements(COALESCE(fp.post_data->'comments', '[]'::jsonb)) AS comment_elem
            LEFT JOIN public.users_profiles comment_author
              ON comment_author.id = (comment_elem->>'author_id')::uuid
          ),
          '[]'::jsonb
        )
      )
    ORDER BY
      CASE WHEN COALESCE((fp.post_data->>'is_pinned')::boolean, false) THEN 0 ELSE 1 END,
      (fp.post_data->>'created_at')::timestamp DESC
  )
  INTO v_enriched_posts
  FROM filtered_posts fp
  LEFT JOIN public.users_profiles post_author ON post_author.id = fp.post_author_id;

  RETURN COALESCE(v_enriched_posts, '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.add_group_post(
  p_group_id UUID,
  p_author_id UUID,
  p_content TEXT,
  p_attachments JSONB DEFAULT NULL
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_new_post JSONB;
  v_expires_at TIMESTAMP;
  v_sanitized_content TEXT;
  v_has_attachments BOOLEAN;
  v_rate_limit JSONB;
  v_attachment_validation JSONB;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Autenticação necessária');
  END IF;

  IF p_author_id IS DISTINCT FROM auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Autor inválido para este post');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.study_group_members
    WHERE group_id = p_group_id
      AND user_id = p_author_id
      AND status = 'active'
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Apenas membros do grupo podem publicar');
  END IF;

  v_rate_limit := public.assert_group_content_rate_limit(
    'add_group_post',
    p_group_id,
    10,
    3600
  );

  IF COALESCE((v_rate_limit->>'allowed')::boolean, false) IS NOT TRUE THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', COALESCE(v_rate_limit->>'error', 'Limite de posts atingido')
    );
  END IF;

  v_sanitized_content := public.sanitize_group_text_content(p_content);
  v_has_attachments := p_attachments IS NOT NULL AND jsonb_array_length(p_attachments) > 0;

  IF btrim(v_sanitized_content) = '' AND NOT v_has_attachments THEN
    RETURN jsonb_build_object('success', false, 'error', 'Conteúdo do post não pode ser vazio');
  END IF;

  IF char_length(v_sanitized_content) > 500 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Conteúdo do post excede 500 caracteres');
  END IF;

  IF v_has_attachments THEN
    v_attachment_validation := public.validate_group_post_attachments(p_group_id, p_attachments);

    IF COALESCE((v_attachment_validation->>'valid')::boolean, false) IS NOT TRUE THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', COALESCE(v_attachment_validation->>'error', 'Anexos inválidos')
      );
    END IF;
  END IF;

  SELECT NOW() + (COALESCE(post_retention_days, 365) || ' days')::INTERVAL
  INTO v_expires_at
  FROM public.study_groups
  WHERE id = p_group_id;

  IF v_expires_at IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Grupo não encontrado');
  END IF;

  v_new_post := jsonb_build_object(
    'id', gen_random_uuid(),
    'author_id', p_author_id,
    'content', v_sanitized_content,
    'comments_count', 0,
    'comments', '[]'::jsonb,
    'is_pinned', false,
    'is_deleted', false,
    'expires_at', v_expires_at,
    'created_at', NOW(),
    'attachments', COALESCE(p_attachments, '[]'::jsonb)
  );

  UPDATE public.study_groups
  SET
    posts_data = jsonb_insert(
      COALESCE(posts_data, '[]'::jsonb),
      '{0}',
      v_new_post
    ),
    updated_at = NOW()
  WHERE id = p_group_id;

  RETURN jsonb_build_object('success', true, 'post', v_new_post);
END;
$$;

CREATE OR REPLACE FUNCTION public.add_post_comment(
  p_group_id UUID,
  p_post_id UUID,
  p_author_id UUID,
  p_content TEXT,
  p_parent_comment_id UUID DEFAULT NULL
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_new_comment JSONB;
  v_post_idx INTEGER;
  v_posts JSONB;
  v_updated_posts JSONB;
  v_post JSONB;
  v_comments JSONB;
  v_comments_count INTEGER;
  v_comment_id TEXT;
  v_sanitized_content TEXT;
  v_rate_limit JSONB;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Autenticação necessária');
  END IF;

  IF p_author_id IS DISTINCT FROM auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Autor inválido para este comentário');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.study_group_members
    WHERE group_id = p_group_id
      AND user_id = p_author_id
      AND status = 'active'
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Apenas membros do grupo podem comentar'
    );
  END IF;

  v_rate_limit := public.assert_group_content_rate_limit(
    'add_post_comment',
    p_group_id,
    30,
    3600
  );

  IF COALESCE((v_rate_limit->>'allowed')::boolean, false) IS NOT TRUE THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', COALESCE(v_rate_limit->>'error', 'Limite de comentários atingido')
    );
  END IF;

  v_sanitized_content := public.sanitize_group_text_content(p_content);

  IF btrim(v_sanitized_content) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Comentário não pode ser vazio');
  END IF;

  IF char_length(v_sanitized_content) > 500 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Comentário excede 500 caracteres');
  END IF;

  v_comment_id := gen_random_uuid()::text;

  v_new_comment := jsonb_build_object(
    'id', v_comment_id,
    'author_id', p_author_id::text,
    'content', v_sanitized_content,
    'parent_comment_id', COALESCE(p_parent_comment_id::text, NULL),
    'created_at', NOW()::text
  );

  SELECT posts_data
  INTO v_posts
  FROM public.study_groups
  WHERE id = p_group_id;

  IF v_posts IS NULL OR jsonb_array_length(v_posts) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Nenhum post encontrado no grupo');
  END IF;

  SELECT idx
  INTO v_post_idx
  FROM (
    SELECT
      row_number() OVER () - 1 AS idx,
      (value->>'id')::text AS post_id
    FROM jsonb_array_elements(v_posts) AS value
  ) posts_with_idx
  WHERE post_id = p_post_id::text
  LIMIT 1;

  IF v_post_idx IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Post não encontrado');
  END IF;

  v_post := v_posts->v_post_idx;
  v_comments := COALESCE(v_post->'comments', '[]'::jsonb) || v_new_comment;
  v_comments_count := jsonb_array_length(v_comments);

  v_post := jsonb_set(
    jsonb_set(v_post, '{comments}', v_comments),
    '{comments_count}',
    to_jsonb(v_comments_count)
  );

  v_updated_posts := jsonb_set(v_posts, ARRAY[v_post_idx::text], v_post);

  UPDATE public.study_groups
  SET
    posts_data = v_updated_posts,
    updated_at = NOW()
  WHERE id = p_group_id;

  PERFORM public.notify_group_comment_mentions(
    p_group_id,
    p_post_id,
    v_comment_id,
    p_author_id,
    v_sanitized_content
  );

  RETURN jsonb_build_object(
    'success', true,
    'comment', v_new_comment,
    'comments_count', v_comments_count
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_group_feed(UUID, INTEGER, INTEGER) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_group_feed(UUID, INTEGER, INTEGER) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.assert_group_content_rate_limit(TEXT, UUID, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_group_post_attachments(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_group_feed(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_group_feed(UUID, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_group_post(UUID, UUID, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_post_comment(UUID, UUID, UUID, TEXT, UUID) TO authenticated;

COMMENT ON FUNCTION public.validate_group_post_attachments(UUID, JSONB) IS
  'Valida anexos de posts: bucket profiles/group-posts, domínio Supabase e pertencimento ao grupo.';
COMMENT ON FUNCTION public.can_view_group_feed(UUID, UUID) IS
  'Controla acesso ao feed: plano Pro/Coach, grupos privados/invite_only exigem membership ativa.';
COMMENT ON FUNCTION public.assert_group_content_rate_limit(TEXT, UUID, INTEGER, INTEGER) IS
  'Aplica rate limiting de posts/comentários via audit_logs.';
