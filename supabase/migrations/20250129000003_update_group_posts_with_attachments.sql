-- ============================================
-- ATUALIZAÇÃO: Suporte a anexos e enriquecimento de posts
-- Data: 2025-01-29
-- ============================================

-- Atualizar função add_group_post para suportar anexos
CREATE OR REPLACE FUNCTION add_group_post(
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
BEGIN
  -- Calcular expires_at
  v_expires_at := calculate_post_expires_at(p_group_id);
  
  -- Criar novo post com anexos
  v_new_post := jsonb_build_object(
    'id', gen_random_uuid(),
    'author_id', p_author_id,
    'content', p_content,
    'comments_count', 0,
    'comments', '[]'::jsonb,
    'is_pinned', false,
    'is_deleted', false,
    'expires_at', v_expires_at,
    'created_at', NOW()
  );
  
  -- Adicionar anexos se fornecidos
  IF p_attachments IS NOT NULL AND jsonb_array_length(p_attachments) > 0 THEN
    v_new_post := v_new_post || jsonb_build_object('attachments', p_attachments);
  END IF;
  
  -- Adicionar ao início do array
  UPDATE study_groups
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

-- Atualizar função get_group_feed para enriquecer posts com informações do autor e comentários
CREATE OR REPLACE FUNCTION get_group_feed(
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
  v_posts JSONB;
  v_enriched_posts JSONB := '[]'::jsonb;
BEGIN
  -- Buscar posts básicos
  SELECT jsonb_agg(
    post ORDER BY 
      CASE WHEN (post->>'is_pinned')::boolean THEN 0 ELSE 1 END,
      (post->>'created_at')::timestamp DESC
  )
  INTO v_posts
  FROM (
    SELECT value as post
    FROM study_groups,
    jsonb_array_elements(posts_data) as value
    WHERE study_groups.id = p_group_id
      AND (value->>'is_deleted')::boolean = false
      AND (value->>'expires_at')::timestamp > NOW()
    ORDER BY 
      CASE WHEN (value->>'is_pinned')::boolean THEN 0 ELSE 1 END,
      (value->>'created_at')::timestamp DESC
    LIMIT p_limit
    OFFSET p_offset
  ) filtered_posts;
  
  IF v_posts IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;
  
  -- Enriquecer posts com informações do autor e comentários
  SELECT jsonb_agg(
    post_post || jsonb_build_object(
      'author_name', COALESCE(up.name, 'Usuário'),
      'author_avatar', up.avatar_url
    ) || jsonb_build_object(
      'comments', COALESCE(
        (
          SELECT jsonb_agg(
            comment || jsonb_build_object(
              'author_name', COALESCE(comment_author.name, 'Usuário'),
              'author_avatar', comment_author.avatar_url
            )
          )
          FROM jsonb_array_elements(post_post->'comments') as comment
          LEFT JOIN users_profiles comment_author ON comment_author.id::text = (comment->>'author_id')
        ),
        '[]'::jsonb
      )
    )
  )
  INTO v_enriched_posts
  FROM jsonb_array_elements(v_posts) as post_post
  LEFT JOIN users_profiles up ON up.id::text = (post_post->>'author_id');
  
  RETURN COALESCE(v_enriched_posts, '[]'::jsonb);
END;
$$;

-- Atualizar permissões
GRANT EXECUTE ON FUNCTION public.add_group_post(UUID, UUID, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_group_feed(UUID, INTEGER, INTEGER) TO anon, authenticated;







