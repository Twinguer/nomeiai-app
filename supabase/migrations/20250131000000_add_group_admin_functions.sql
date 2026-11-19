-- Migration: Add admin functions for group management
-- Functions: delete_study_group, delete_group_post, remove_group_member

-- ============================================
-- 1. DELETAR POST DO GRUPO
-- ============================================
CREATE OR REPLACE FUNCTION delete_group_post(
  p_group_id UUID,
  p_post_id UUID
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_updated_data JSONB;
  v_is_admin BOOLEAN;
BEGIN
  -- Verificar se o usuário é admin do grupo OU criador do grupo
  SELECT 
    EXISTS (
      SELECT 1 FROM study_group_members
      WHERE group_id = p_group_id
        AND user_id = auth.uid()
        AND role IN ('admin', 'coach')
        AND status = 'active'
    )
    OR EXISTS (
      SELECT 1 FROM study_groups
      WHERE id = p_group_id
        AND created_by = auth.uid()
    )
  INTO v_is_admin;

  IF NOT v_is_admin THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Apenas administradores podem excluir posts'
    );
  END IF;

  -- Marcar post como deletado no JSONB
  UPDATE study_groups
  SET 
    posts_data = (
      SELECT COALESCE(jsonb_agg(post), '[]'::jsonb)
      FROM jsonb_array_elements(posts_data) as post
      WHERE (post->>'id')::uuid != p_post_id
    ),
    updated_at = NOW()
  WHERE id = p_group_id
  RETURNING posts_data INTO v_updated_data;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Post excluído com sucesso'
  );
END;
$$;

-- ============================================
-- 2. REMOVER MEMBRO DO GRUPO (apenas admin ou criador)
-- ============================================
CREATE OR REPLACE FUNCTION remove_group_member(
  p_group_id UUID,
  p_member_id UUID,
  p_admin_id UUID
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_member_role TEXT;
  v_member_user_id UUID;
  v_is_admin BOOLEAN;
  v_created_by UUID;
BEGIN
  -- Verificar se o admin é realmente admin do grupo OU criador do grupo
  SELECT created_by INTO v_created_by
  FROM study_groups
  WHERE id = p_group_id;

  SELECT 
    EXISTS (
      SELECT 1 FROM study_group_members
      WHERE group_id = p_group_id
        AND user_id = p_admin_id
        AND role IN ('admin', 'coach')
        AND status = 'active'
    )
    OR (v_created_by = p_admin_id)
  INTO v_is_admin;

  IF NOT v_is_admin THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Apenas administradores ou o criador do grupo podem remover membros'
    );
  END IF;

  -- Buscar informações do membro
  SELECT user_id, role INTO v_member_user_id, v_member_role
  FROM study_group_members
  WHERE id = p_member_id
    AND group_id = p_group_id;

  IF v_member_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Membro não encontrado'
    );
  END IF;

  -- Criador não pode ser removido
  IF v_created_by = v_member_user_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'O criador do grupo não pode ser removido'
    );
  END IF;

  -- Remover membro (soft delete) - sem updated_at pois a coluna não existe
  UPDATE study_group_members
  SET status = 'removed'
  WHERE id = p_member_id
    AND group_id = p_group_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Membro removido com sucesso'
  );
END;
$$;

-- ============================================
-- 3. DELETAR GRUPO (apenas criador)
-- ============================================
CREATE OR REPLACE FUNCTION delete_study_group(
  p_group_id UUID
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_created_by UUID;
BEGIN
  -- Verificar se o usuário é o criador
  SELECT created_by INTO v_created_by
  FROM study_groups
  WHERE id = p_group_id;

  IF v_created_by IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Grupo não encontrado'
    );
  END IF;

  IF v_created_by != auth.uid() THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Apenas o criador pode excluir o grupo'
    );
  END IF;

  -- Deletar membros
  DELETE FROM study_group_members
  WHERE group_id = p_group_id;

  -- Deletar pedidos pendentes (se a tabela existir)
  -- DELETE FROM study_group_join_requests
  -- WHERE group_id = p_group_id;

  -- Deletar grupo
  DELETE FROM study_groups
  WHERE id = p_group_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Grupo excluído com sucesso'
  );
END;
$$;

-- Permissões
GRANT EXECUTE ON FUNCTION public.delete_group_post(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_group_member(UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_study_group(UUID) TO authenticated;
