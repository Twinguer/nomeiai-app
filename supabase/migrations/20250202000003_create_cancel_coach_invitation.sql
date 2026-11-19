-- ============================================
-- Migration: Função para Cancelar Convite de Coach
-- Data: 2025-02-02
-- Objetivo: Criar função RPC cancel_coach_invitation
-- ============================================

CREATE OR REPLACE FUNCTION cancel_coach_invitation(
  p_invitation_id UUID,
  p_coach_id UUID
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_invitation RECORD;
BEGIN
  -- 1. Buscar o convite
  SELECT 
    id,
    coach_id,
    status,
    student_id
  INTO v_invitation
  FROM coach_invitations_history
  WHERE id = p_invitation_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Convite não encontrado'
    );
  END IF;
  
  -- 2. Verificar se o coach é o dono do convite
  IF v_invitation.coach_id != p_coach_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Você não tem permissão para cancelar este convite'
    );
  END IF;
  
  -- 3. Verificar se o convite ainda está pendente
  IF v_invitation.status != 'pending' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', CASE 
        WHEN v_invitation.status = 'accepted' THEN 'Este convite já foi aceito e não pode ser cancelado'
        WHEN v_invitation.status = 'rejected' THEN 'Este convite já foi recusado'
        WHEN v_invitation.status = 'cancelled' THEN 'Este convite já foi cancelado'
        ELSE 'Este convite não pode ser cancelado'
      END
    );
  END IF;
  
  -- 4. Cancelar o convite
  UPDATE coach_invitations_history
  SET 
    status = 'cancelled',
    responded_at = NOW(),
    updated_at = NOW()
  WHERE id = p_invitation_id;
  
  -- 5. Remover notificação associada (se existir)
  DELETE FROM notifications
  WHERE type = 'coach_invitation'
    AND metadata->>'invitation_id' = p_invitation_id::text;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Convite cancelado com sucesso'
  );
END;
$$;

-- Permissões
GRANT EXECUTE ON FUNCTION cancel_coach_invitation(UUID, UUID) TO authenticated;

-- Comentário
COMMENT ON FUNCTION cancel_coach_invitation IS 'Cancela um convite de coach enviado (apenas se ainda estiver pendente)';

