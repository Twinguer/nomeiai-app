-- ============================================
-- SINCRONIZAÇÃO COMPLETA: Todas as funções de grupos
-- Data: 2025-01-29
-- Sincroniza TODAS as funções do desenvolvimento
-- ============================================

-- 1. Remover versão antiga de add_group_post (sem p_attachments)
DROP FUNCTION IF EXISTS public.add_group_post(uuid, uuid, text);

-- 2. Atualizar add_group_post com suporte completo a attachments
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
BEGIN
  -- Calcular expires_at
  SELECT NOW() + (COALESCE(post_retention_days, 90) || ' days')::INTERVAL
  INTO v_expires_at
  FROM study_groups 
  WHERE id = p_group_id;
  
  -- Criar novo post com anexos (sempre incluir campo attachments)
  v_new_post := jsonb_build_object(
    'id', gen_random_uuid(),
    'author_id', p_author_id,
    'content', COALESCE(p_content, ''),
    'comments_count', 0,
    'comments', '[]'::jsonb,
    'is_pinned', false,
    'is_deleted', false,
    'expires_at', v_expires_at,
    'created_at', NOW(),
    'attachments', COALESCE(p_attachments, '[]'::jsonb)
  );
  
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

-- 3. Atualizar add_post_comment (já existe, mas garantindo que está atualizada)
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
  v_expires_at TIMESTAMP;
  v_post_idx INTEGER;
  v_posts JSONB;
BEGIN
  v_expires_at := calculate_post_expires_at(p_group_id);
  
  v_new_comment := jsonb_build_object(
    'id', gen_random_uuid(),
    'author_id', p_author_id,
    'content', p_content,
    'parent_comment_id', p_parent_comment_id,
    'created_at', NOW()
  );
  
  SELECT posts_data INTO v_posts
  FROM study_groups
  WHERE id = p_group_id;
  
  SELECT idx INTO v_post_idx
  FROM (
    SELECT 
      row_number() OVER () - 1 as idx,
      (value->>'id')::text as post_id
    FROM jsonb_array_elements(v_posts)
  ) posts_with_idx
  WHERE post_id = p_post_id::text
  LIMIT 1;
  
  IF v_post_idx IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Post não encontrado');
  END IF;
  
  UPDATE study_groups
  SET 
    posts_data = jsonb_set(
      posts_data,
      ARRAY[v_post_idx::text, 'comments'],
      COALESCE(posts_data->v_post_idx->'comments', '[]'::jsonb) || v_new_comment
    ),
    posts_data = jsonb_set(
      posts_data,
      ARRAY[v_post_idx::text, 'comments_count'],
      to_jsonb((COALESCE((posts_data->v_post_idx->>'comments_count')::integer, 0) + 1))
    ),
    updated_at = NOW()
  WHERE id = p_group_id;
  
  RETURN jsonb_build_object('success', true, 'comment', v_new_comment);
END;
$$;

-- 4. Atualizar get_group_feed com enriquecimento completo (CTE)
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
  v_enriched_posts JSONB;
BEGIN
  WITH filtered_posts AS (
    SELECT 
      value as post_data,
      (value->>'author_id')::uuid as post_author_id
    FROM study_groups,
    jsonb_array_elements(COALESCE(posts_data, '[]'::jsonb)) as value
    WHERE study_groups.id = p_group_id
      AND (value->>'is_deleted')::boolean = false
      AND (value->>'expires_at')::timestamp > NOW()
    ORDER BY 
      CASE WHEN (value->>'is_pinned')::boolean THEN 0 ELSE 1 END,
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
            FROM jsonb_array_elements(COALESCE(fp.post_data->'comments', '[]'::jsonb)) as comment_elem
            LEFT JOIN users_profiles comment_author 
              ON comment_author.id = (comment_elem->>'author_id')::uuid
          ),
          '[]'::jsonb
        )
      )
    ORDER BY 
      CASE WHEN ((fp.post_data->>'is_pinned')::boolean) THEN 0 ELSE 1 END,
      (fp.post_data->>'created_at')::timestamp DESC
  )
  INTO v_enriched_posts
  FROM filtered_posts fp
  LEFT JOIN users_profiles post_author ON post_author.id = fp.post_author_id;
  
  RETURN COALESCE(v_enriched_posts, '[]'::jsonb);
END;
$$;

-- 5. Atualizar get_group_members para retornar user_id e status
DROP FUNCTION IF EXISTS public.get_group_members(uuid);
CREATE OR REPLACE FUNCTION public.get_group_members(p_group_id UUID)
RETURNS TABLE(
  id UUID,
  user_id UUID,
  name TEXT,
  avatar_url TEXT,
  role TEXT,
  status TEXT,
  joined_at TIMESTAMP
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    up.id as id,
    sgm.user_id,
    up.name, 
    up.avatar_url,
    sgm.role,
    sgm.status,
    sgm.joined_at
  FROM study_group_members sgm
  JOIN users_profiles up ON up.id = sgm.user_id
  WHERE sgm.group_id = p_group_id
    AND sgm.status = 'active'
  ORDER BY sgm.joined_at ASC;
$$;

-- 6. Criar/atualizar get_user_group_status
CREATE OR REPLACE FUNCTION public.get_user_group_status(
  p_group_id UUID,
  p_user_id UUID
)
RETURNS TABLE(
  is_member BOOLEAN,
  role TEXT,
  status TEXT,
  has_requested BOOLEAN,
  is_invited BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status TEXT;
  v_role TEXT;
BEGIN
  SELECT sgm.status, sgm.role INTO v_status, v_role
  FROM study_group_members sgm
  WHERE sgm.group_id = p_group_id
    AND sgm.user_id = p_user_id
  LIMIT 1;

  IF v_status IS NULL THEN
    RETURN QUERY SELECT false, NULL::TEXT, NULL::TEXT, false, false;
  ELSE
    RETURN QUERY SELECT 
      v_status = 'active' as is_member,
      v_role,
      v_status,
      v_status = 'requested' as has_requested,
      v_status = 'invited' as is_invited;
  END IF;
END;
$$;

-- 7. Criar/atualizar user_is_group_member
CREATE OR REPLACE FUNCTION public.user_is_group_member(
  p_group_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM study_group_members sgm
    WHERE sgm.group_id = p_group_id
      AND sgm.user_id = p_user_id
      AND sgm.status = 'active'
  );
$$;

-- 8. Garantir que respond_to_join_request existe e está atualizada
CREATE OR REPLACE FUNCTION public.respond_to_join_request(
  p_member_id UUID,
  p_group_id UUID,
  p_admin_id UUID,
  p_accept BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request RECORD;
  v_group RECORD;
BEGIN
  SELECT * INTO v_request
  FROM study_group_members
  WHERE id = p_member_id
    AND group_id = p_group_id
    AND status = 'requested';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pedido não encontrado');
  END IF;

  SELECT * INTO v_group
  FROM study_groups
  WHERE id = p_group_id;

  IF v_group.created_by != p_admin_id 
    AND NOT is_group_admin(p_group_id, p_admin_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sem permissão');
  END IF;

  IF p_accept THEN
    UPDATE study_group_members
    SET status = 'active', joined_at = NOW()
    WHERE id = p_member_id;
    RETURN jsonb_build_object('success', true, 'message', 'Pedido aceito');
  ELSE
    UPDATE study_group_members
    SET status = 'removed'
    WHERE id = p_member_id;
    RETURN jsonb_build_object('success', true, 'message', 'Pedido rejeitado');
  END IF;
END;
$$;

-- 9. Garantir que invite_user_to_group está atualizada
CREATE OR REPLACE FUNCTION public.invite_user_to_group(
  p_group_id UUID,
  p_user_id UUID,
  p_inviter_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group RECORD;
  v_existing RECORD;
BEGIN
  SELECT * INTO v_group FROM study_groups WHERE id = p_group_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Grupo não encontrado');
  END IF;

  IF v_group.created_by != p_inviter_id AND NOT is_group_admin(p_group_id, p_inviter_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Apenas admins podem convidar');
  END IF;

  SELECT * INTO v_existing FROM study_group_members
    WHERE group_id = p_group_id AND user_id = p_user_id;

  IF FOUND THEN
    IF v_existing.status = 'active' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Usuário já é membro');
    ELSIF v_existing.status = 'invited' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Convite já enviado');
    ELSE
      UPDATE study_group_members SET status = 'invited', invited_by = p_inviter_id WHERE id = v_existing.id;
      RETURN jsonb_build_object('success', true, 'message', 'Convite enviado');
    END IF;
  END IF;

  INSERT INTO study_group_members (group_id, user_id, status, role, invited_by)
  VALUES (p_group_id, p_user_id, 'invited', 'member', p_inviter_id)
  ON CONFLICT (group_id, user_id) DO UPDATE SET status = 'invited', invited_by = p_inviter_id;

  RETURN jsonb_build_object('success', true, 'message', 'Convite enviado');
END;
$$;

-- Permissões
GRANT EXECUTE ON FUNCTION public.add_group_post(UUID, UUID, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_post_comment(UUID, UUID, UUID, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_group_feed(UUID, INTEGER, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_group_status(UUID, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_group_members(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.user_is_group_member(UUID, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.respond_to_join_request(UUID, UUID, UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.invite_user_to_group(UUID, UUID, UUID) TO authenticated;







