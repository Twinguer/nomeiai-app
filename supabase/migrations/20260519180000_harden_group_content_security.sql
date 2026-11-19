-- Endurecer segurança de posts e comentários em grupos:
-- autenticação do autor, limite de tamanho e sanitização de texto.

CREATE OR REPLACE FUNCTION public.sanitize_group_text_content(p_content TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_result TEXT;
BEGIN
  IF p_content IS NULL THEN
    RETURN '';
  END IF;

  v_result := p_content;
  v_result := regexp_replace(v_result, '<[^>]*>', '', 'g');
  v_result := regexp_replace(v_result, '[[:cntrl:]]', '', 'g');

  RETURN v_result;
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

  v_sanitized_content := public.sanitize_group_text_content(p_content);
  v_has_attachments := p_attachments IS NOT NULL AND jsonb_array_length(p_attachments) > 0;

  IF btrim(v_sanitized_content) = '' AND NOT v_has_attachments THEN
    RETURN jsonb_build_object('success', false, 'error', 'Conteúdo do post não pode ser vazio');
  END IF;

  IF char_length(v_sanitized_content) > 500 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Conteúdo do post excede 500 caracteres');
  END IF;

  IF v_has_attachments AND jsonb_array_length(p_attachments) > 5 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Máximo de 5 anexos por post');
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

GRANT EXECUTE ON FUNCTION public.sanitize_group_text_content(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_group_post(UUID, UUID, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_post_comment(UUID, UUID, UUID, TEXT, UUID) TO authenticated;

COMMENT ON FUNCTION public.sanitize_group_text_content(TEXT) IS
  'Remove tags HTML e caracteres de controle de conteúdo textual de grupos.';
