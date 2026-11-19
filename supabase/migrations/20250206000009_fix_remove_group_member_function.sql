-- ============================================================================
-- MIGRATION: Garantir que remove_group_member existe e está correta
-- DATA: 2025-02-06
-- OBJETIVO: Remover funções antigas e garantir que a função correta existe
-- ============================================================================

-- Remover função antiga se existir (com nome diferente)
DROP FUNCTION IF EXISTS public.remove_public_group_member(UUID, UUID, UUID);
DROP FUNCTION IF EXISTS public.remove_public_group_member(UUID, UUID, UUID, TEXT);

-- Garantir que a função remove_group_member existe e está correta
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

  IF v_created_by IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Grupo não encontrado'
    );
  END IF;

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

  -- Remover membro (soft delete)
  UPDATE study_group_members
  SET status = 'removed',
      updated_at = NOW()
  WHERE id = p_member_id
    AND group_id = p_group_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Membro removido com sucesso'
  );
END;
$$;

-- Garantir permissões
GRANT EXECUTE ON FUNCTION public.remove_group_member(UUID, UUID, UUID) TO authenticated;

-- Comentário
COMMENT ON FUNCTION public.remove_group_member(UUID, UUID, UUID) IS 
  'Remove um membro de um grupo. Apenas criadores ou admins do grupo podem remover membros. Parâmetros: p_group_id, p_member_id, p_admin_id.';



