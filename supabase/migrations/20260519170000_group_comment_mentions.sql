-- Menções @nickname em comentários de grupos com notificação aos membros mencionados.

CREATE OR REPLACE FUNCTION public.notify_group_comment_mentions(
  p_group_id UUID,
  p_post_id UUID,
  p_comment_id TEXT,
  p_author_id UUID,
  p_content TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group_name TEXT;
  v_author_name TEXT;
  v_mentioned_user_id UUID;
  v_nickname TEXT;
  v_mention_count INTEGER := 0;
  v_max_mentions CONSTANT INTEGER := 5;
BEGIN
  IF p_content IS NULL OR btrim(p_content) = '' THEN
    RETURN;
  END IF;

  SELECT sg.name
  INTO v_group_name
  FROM public.study_groups sg
  WHERE sg.id = p_group_id;

  SELECT up.name
  INTO v_author_name
  FROM public.users_profiles up
  WHERE up.id = p_author_id;

  FOR v_nickname IN
    SELECT DISTINCT LOWER(matches[1])
    FROM regexp_matches(p_content, '@([a-z0-9_.]{3,20})', 'gi') AS matches
  LOOP
    EXIT WHEN v_mention_count >= v_max_mentions;

    SELECT up.id
    INTO v_mentioned_user_id
    FROM public.users_profiles up
    WHERE LOWER(up.nickname) = v_nickname
    LIMIT 1;

    IF v_mentioned_user_id IS NULL OR v_mentioned_user_id = p_author_id THEN
      CONTINUE;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.study_group_members sgm
      WHERE sgm.group_id = p_group_id
        AND sgm.user_id = v_mentioned_user_id
        AND sgm.status = 'active'
    ) THEN
      CONTINUE;
    END IF;

    INSERT INTO public.notifications (
      user_id,
      type,
      title,
      message,
      metadata
    ) VALUES (
      v_mentioned_user_id,
      'group_mention',
      'Menção em grupo',
      COALESCE(v_author_name, 'Alguém')
        || ' mencionou você em '
        || COALESCE(v_group_name, 'um grupo de estudos'),
      jsonb_build_object(
        'group_id', p_group_id,
        'post_id', p_post_id,
        'comment_id', p_comment_id,
        'author_id', p_author_id,
        'author_name', v_author_name,
        'group_name', v_group_name
      )
    );

    v_mention_count := v_mention_count + 1;
  END LOOP;
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
BEGIN
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

  v_comment_id := gen_random_uuid()::text;

  v_new_comment := jsonb_build_object(
    'id', v_comment_id,
    'author_id', p_author_id::text,
    'content', p_content,
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
    p_content
  );

  RETURN jsonb_build_object(
    'success', true,
    'comment', v_new_comment,
    'comments_count', v_comments_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.notify_group_comment_mentions(UUID, UUID, TEXT, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_post_comment(UUID, UUID, UUID, TEXT, UUID) TO authenticated;

COMMENT ON FUNCTION public.notify_group_comment_mentions(UUID, UUID, TEXT, UUID, TEXT) IS
  'Cria notificações para membros do grupo mencionados via @nickname em comentários.';
