-- ============================================
-- FUNÇÃO RPC: Sair do grupo (evita recursão RLS)
-- Data: 2025-12-01
-- ============================================

-- Criar função RPC para sair do grupo usando SECURITY DEFINER
-- Isso evita problemas de recursão infinita nas políticas RLS
CREATE OR REPLACE FUNCTION public.leave_study_group(
  p_group_id UUID,
  p_user_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSON;
  v_is_member BOOLEAN;
BEGIN
  -- Verificar se o usuário é membro ativo do grupo
  SELECT EXISTS (
    SELECT 1 
    FROM study_group_members sgm
    WHERE sgm.group_id = p_group_id
      AND sgm.user_id = p_user_id
      AND sgm.status = 'active'
  ) INTO v_is_member;

  IF NOT v_is_member THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Você não é membro deste grupo'
    );
  END IF;

  -- Verificar se o usuário é o criador do grupo
  IF EXISTS (
    SELECT 1 
    FROM study_groups sg
    WHERE sg.id = p_group_id
      AND sg.created_by = p_user_id
  ) THEN
    RETURN json_build_object(
      'success', false,
      'message', 'O criador do grupo não pode sair. Transfira a administração primeiro.'
    );
  END IF;

  -- Atualizar status para 'left' (desabilitar RLS temporariamente)
  PERFORM set_config('row_security', 'off', true);
  
  UPDATE study_group_members
  SET status = 'left'
  WHERE group_id = p_group_id
    AND user_id = p_user_id
    AND status = 'active';

  -- Reabilitar RLS
  PERFORM set_config('row_security', 'on', true);

  -- Atualizar contador de membros do grupo
  UPDATE study_groups
  SET current_members = GREATEST(0, current_members - 1),
      updated_at = NOW()
  WHERE id = p_group_id;

  RETURN json_build_object(
    'success', true,
    'message', 'Você saiu do grupo com sucesso'
  );
EXCEPTION
  WHEN OTHERS THEN
    -- Reabilitar RLS em caso de erro
    PERFORM set_config('row_security', 'on', true);
    RETURN json_build_object(
      'success', false,
      'message', 'Erro ao sair do grupo: ' || SQLERRM
    );
END;
$$;

-- Conceder permissões
GRANT EXECUTE ON FUNCTION public.leave_study_group(UUID, UUID) TO authenticated;

-- Comentário explicativo
COMMENT ON FUNCTION public.leave_study_group(UUID, UUID) IS 
'Permite que um usuário saia de um grupo de estudos. Usa SECURITY DEFINER para evitar recursão infinita nas políticas RLS.';

