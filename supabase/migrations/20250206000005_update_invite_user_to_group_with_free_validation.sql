-- ============================================================================
-- MIGRATION: Atualizar invite_user_to_group com validação de plano Free
-- DATA: 2025-02-06
-- OBJETIVO: Bloquear convites para usuários Free
-- ============================================================================

-- Atualizar função invite_user_to_group para validar plano do usuário convidado
CREATE OR REPLACE FUNCTION invite_user_to_group(
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
  v_user_plan subscription_plan;
BEGIN
  -- VALIDAÇÃO: Verificar plano do usuário convidado
  v_user_plan := public.get_user_subscription_plan(p_user_id);
  IF v_user_plan IS NULL THEN
    v_user_plan := 'free'::subscription_plan;
  END IF;

  -- Free não pode ser convidado para grupos
  IF v_user_plan = 'free' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Usuários do plano Free não podem participar de grupos. O usuário precisa fazer upgrade para Pro.',
      'requires_upgrade', true
    );
  END IF;

  -- Verificar se convidante é admin/criador
  SELECT * INTO v_group
  FROM study_groups
  WHERE id = p_group_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Grupo não encontrado');
  END IF;

  IF v_group.created_by != p_inviter_id 
    AND NOT is_group_admin(p_group_id, p_inviter_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Apenas admins podem convidar');
  END IF;

  -- Verificar se já existe
  SELECT * INTO v_existing
  FROM study_group_members
  WHERE group_id = p_group_id
    AND user_id = p_user_id;

  IF FOUND THEN
    IF v_existing.status = 'active' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Usuário já é membro');
    ELSIF v_existing.status = 'invited' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Convite já enviado');
    ELSE
      -- Atualizar para convidado
      UPDATE study_group_members
      SET status = 'invited', invited_by = p_inviter_id
      WHERE id = v_existing.id;
      RETURN jsonb_build_object('success', true, 'message', 'Convite enviado');
    END IF;
  END IF;

  -- Criar convite
  INSERT INTO study_group_members (group_id, user_id, status, role, invited_by)
  VALUES (p_group_id, p_user_id, 'invited', 'member', p_inviter_id)
  ON CONFLICT (group_id, user_id) DO UPDATE
  SET status = 'invited', invited_by = p_inviter_id;

  RETURN jsonb_build_object('success', true, 'message', 'Convite enviado');
END;
$$;

COMMENT ON FUNCTION invite_user_to_group(UUID, UUID, UUID) IS 
  'Convida um usuário para um grupo de estudos. Bloqueia convites para usuários Free - apenas Pro pode ser convidado.';

