-- ============================================================================
-- MIGRATION: Atualizar request_to_join_group com validação de plano Free
-- DATA: 2025-02-06
-- OBJETIVO: Bloquear entrada em grupos para usuários Free
-- ============================================================================

-- Atualizar função request_to_join_group para validar plano antes de permitir entrada
CREATE OR REPLACE FUNCTION request_to_join_group(p_group_id UUID, p_user_id UUID)
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
  -- VALIDAÇÃO: Verificar plano do usuário
  v_user_plan := public.get_user_subscription_plan(p_user_id);
  IF v_user_plan IS NULL THEN
    v_user_plan := 'free'::subscription_plan;
  END IF;

  -- Free não pode entrar em grupos
  IF v_user_plan = 'free' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Grupos de estudos estão disponíveis apenas no plano Pro. Faça upgrade para participar de grupos.',
      'requires_upgrade', true
    );
  END IF;

  -- Verificar se o usuário está tentando entrar como ele mesmo
  IF p_user_id != auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Você só pode solicitar entrada para si mesmo');
  END IF;

  -- Buscar informações do grupo
  SELECT * INTO v_group
  FROM study_groups
  WHERE id = p_group_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Grupo não encontrado');
  END IF;

  -- Verificar se já existe registro
  SELECT * INTO v_existing
  FROM study_group_members
  WHERE group_id = p_group_id
    AND user_id = p_user_id;

  IF FOUND THEN
    IF v_existing.status = 'active' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Você já é membro deste grupo');
    ELSIF v_existing.status = 'requested' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Você já solicitou entrada neste grupo');
    ELSIF v_existing.status = 'invited' THEN
      -- Aceitar convite automaticamente (mas validar plano primeiro)
      -- Validação já foi feita no início da função, então pode aceitar
      UPDATE study_group_members
      SET status = 'active', joined_at = NOW()
      WHERE id = v_existing.id;
      RETURN jsonb_build_object('success', true, 'message', 'Convite aceito');
    ELSE
      -- Reativar pedido
      UPDATE study_group_members
      SET status = 'requested'
      WHERE id = v_existing.id;
      RETURN jsonb_build_object('success', true, 'message', 'Pedido de entrada criado');
    END IF;
  END IF;

  -- Criar novo pedido
  INSERT INTO study_group_members (group_id, user_id, status, role)
  VALUES (p_group_id, p_user_id, 'requested', 'member')
  ON CONFLICT (group_id, user_id) DO UPDATE
  SET status = 'requested';

  RETURN jsonb_build_object('success', true, 'message', 'Pedido de entrada enviado');
END;
$$;

COMMENT ON FUNCTION request_to_join_group(UUID, UUID) IS 
  'Solicita entrada em um grupo de estudos. Bloqueia usuários Free - apenas Pro pode participar de grupos.';

