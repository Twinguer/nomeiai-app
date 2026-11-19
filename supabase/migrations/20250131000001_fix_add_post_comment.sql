-- Migration: Fix add_post_comment function to correctly add comments
-- Problem: The function was trying to update posts_data twice in the same query
-- Solution: Use a single jsonb_set operation with nested updates

CREATE OR REPLACE FUNCTION add_post_comment(
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
  v_expires_at TIMESTAMP;
  v_post_idx INTEGER;
  v_posts JSONB;
  v_updated_posts JSONB;
  v_post JSONB;
  v_comments JSONB;
  v_comments_count INTEGER;
BEGIN
  -- Verificar se o usuário é membro do grupo
  IF NOT EXISTS (
    SELECT 1 FROM study_group_members
    WHERE group_id = p_group_id
      AND user_id = p_author_id
      AND status = 'active'
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Apenas membros do grupo podem comentar'
    );
  END IF;

  -- Calcular expires_at
  v_expires_at := calculate_post_expires_at(p_group_id);
  
  -- Criar comentário
  v_new_comment := jsonb_build_object(
    'id', gen_random_uuid()::text,
    'author_id', p_author_id::text,
    'content', p_content,
    'parent_comment_id', COALESCE(p_parent_comment_id::text, NULL),
    'created_at', NOW()::text
  );
  
  -- Buscar posts
  SELECT posts_data INTO v_posts
  FROM study_groups
  WHERE id = p_group_id;
  
  IF v_posts IS NULL OR jsonb_array_length(v_posts) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Nenhum post encontrado no grupo');
  END IF;
  
  -- Encontrar índice do post
  SELECT idx INTO v_post_idx
  FROM (
    SELECT 
      row_number() OVER () - 1 as idx,
      (value->>'id')::text as post_id,
      value as post_data
    FROM jsonb_array_elements(v_posts) as value
  ) posts_with_idx
  WHERE post_id = p_post_id::text
  LIMIT 1;
  
  IF v_post_idx IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Post não encontrado');
  END IF;
  
  -- Obter post atual
  v_post := v_posts->v_post_idx;
  
  -- Obter comentários existentes e adicionar novo comentário
  v_comments := COALESCE(v_post->'comments', '[]'::jsonb);
  v_comments := v_comments || v_new_comment;
  
  -- Calcular novo contador
  v_comments_count := jsonb_array_length(v_comments);
  
  -- Atualizar post com comentários e contador atualizados
  v_post := jsonb_set(
    jsonb_set(
      v_post,
      '{comments}',
      v_comments
    ),
    '{comments_count}',
    to_jsonb(v_comments_count)
  );
  
  -- Atualizar array de posts
  v_updated_posts := jsonb_set(
    v_posts,
    ARRAY[v_post_idx::text],
    v_post
  );
  
  -- Salvar no banco
  UPDATE study_groups
  SET 
    posts_data = v_updated_posts,
    updated_at = NOW()
  WHERE id = p_group_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'comment', v_new_comment,
    'comments_count', v_comments_count
  );
END;
$$;

-- Permissões
GRANT EXECUTE ON FUNCTION public.add_post_comment(UUID, UUID, UUID, TEXT, UUID) TO authenticated;

