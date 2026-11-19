-- ============================================
-- Migration: Função para Aceitar Convite de Coach
-- Data: 2025-02-02
-- Objetivo: Criar função RPC accept_coach_invitation
-- ============================================

CREATE OR REPLACE FUNCTION accept_coach_invitation(
  p_invitation_id UUID,
  p_consent_data JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_invitation RECORD;
  v_student_id UUID;
  v_coach_id UUID;
  v_relationship JSONB;
BEGIN
  -- 1. Buscar o convite
  SELECT 
    id,
    coach_id,
    student_id,
    status,
    expires_at
  INTO v_invitation
  FROM coach_invitations_history
  WHERE id = p_invitation_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Convite não encontrado'
    );
  END IF;
  
  -- 2. Verificar se o usuário atual é o destinatário do convite
  IF v_invitation.student_id IS NULL OR v_invitation.student_id != auth.uid() THEN
    -- Tentar buscar pelo email também
    IF NOT EXISTS (
      SELECT 1 FROM auth.users 
      WHERE id = auth.uid() 
      AND email = (
        SELECT student_email FROM coach_invitations_history WHERE id = p_invitation_id
      )
    ) THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Você não tem permissão para aceitar este convite'
      );
    END IF;
    
    -- Se encontrou pelo email, atualizar o student_id
    UPDATE coach_invitations_history
    SET student_id = auth.uid()
    WHERE id = p_invitation_id;
    
    v_student_id := auth.uid();
  ELSE
    v_student_id := v_invitation.student_id;
  END IF;
  
  -- 3. Verificar se o convite está pendente
  IF v_invitation.status != 'pending' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', CASE 
        WHEN v_invitation.status = 'accepted' THEN 'Este convite já foi aceito'
        WHEN v_invitation.status = 'rejected' THEN 'Este convite já foi recusado'
        WHEN v_invitation.status = 'expired' THEN 'Este convite expirou'
        ELSE 'Este convite não está mais pendente'
      END
    );
  END IF;
  
  -- 4. Verificar se o convite não expirou
  IF v_invitation.expires_at < NOW() THEN
    -- Marcar como expirado
    UPDATE coach_invitations_history
    SET status = 'expired'
    WHERE id = p_invitation_id;
    
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Este convite expirou'
    );
  END IF;
  
  v_coach_id := v_invitation.coach_id;
  
  -- 5. Verificar se já não é aluno deste coach
  IF EXISTS (
    SELECT 1 FROM coach_profiles cp
    WHERE cp.coach_id = v_coach_id
      AND (
        SELECT COUNT(*) FROM jsonb_array_elements(cp.student_relationships)
        WHERE (value->>'student_id')::uuid = v_student_id
        AND (value->>'status')::text = 'active'
      ) > 0
  ) THEN
    -- Atualizar status do convite mesmo assim
    UPDATE coach_invitations_history
    SET 
      status = 'accepted',
      responded_at = NOW(),
      relationship_id = (
        SELECT (rel->>'relationship_id')::uuid
        FROM coach_profiles cp,
        jsonb_array_elements(cp.student_relationships) AS rel
        WHERE cp.coach_id = v_coach_id
          AND (rel->>'student_id')::uuid = v_student_id
          AND (rel->>'status')::text = 'active'
        LIMIT 1
      )
    WHERE id = p_invitation_id;
    
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Você já faz parte desta equipe',
      'already_member', true
    );
  END IF;
  
  -- 6. Adicionar aluno ao coach usando a função existente
  BEGIN
    SELECT add_student_to_coach(
      v_coach_id,
      v_student_id,
      p_consent_data
    ) INTO v_relationship;
    
    -- 7. Atualizar o convite
    UPDATE coach_invitations_history
    SET 
      status = 'accepted',
      responded_at = NOW(),
      relationship_id = (v_relationship->>'relationship_id')::uuid,
      consent_data = p_consent_data
    WHERE id = p_invitation_id;
    
    -- 8. Remover notificação associada
    DELETE FROM notifications
    WHERE type = 'coach_invitation'
      AND user_id = v_student_id
      AND metadata->>'invitation_id' = p_invitation_id::text;
    
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Convite aceito com sucesso! Você agora faz parte da equipe',
      'relationship', v_relationship
    );
    
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Erro ao adicionar aluno à equipe: ' || SQLERRM
    );
  END;
END;
$$;

-- Permissões
GRANT EXECUTE ON FUNCTION accept_coach_invitation(UUID, JSONB) TO authenticated;

-- Comentário
COMMENT ON FUNCTION accept_coach_invitation IS 'Aceita um convite de coach e adiciona o aluno à equipe';

