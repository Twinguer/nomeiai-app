-- ============================================
-- SISTEMA DE PEDIDOS DE ENTRADA EM GRUPOS
-- Data: 2025-01-29
-- ============================================

-- Atualizar status permitidos para incluir 'requested'
ALTER TABLE study_group_members 
  DROP CONSTRAINT IF EXISTS study_group_members_status_check;

ALTER TABLE study_group_members
  ADD CONSTRAINT study_group_members_status_check 
  CHECK (status IN ('active', 'invited', 'pending', 'requested', 'left', 'removed'));

-- Adicionar campo para rastrear quem convidou
ALTER TABLE study_group_members
  ADD COLUMN IF NOT EXISTS invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- ============================================
-- CORRIGIR POLÍTICAS RLS
-- ============================================

-- Remover políticas antigas
DROP POLICY IF EXISTS "Authenticated users can join groups" ON study_group_members;
DROP POLICY IF EXISTS "View own membership or public groups" ON study_group_members;
DROP POLICY IF EXISTS "Members can view group members" ON study_group_members;

-- SELECT: Criadores podem ver todos os membros e pedidos
CREATE POLICY "Creators can view all members"
  ON study_group_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM study_groups sg
      WHERE sg.id = study_group_members.group_id
      AND sg.created_by = auth.uid()
    )
  );

-- SELECT: Membros ativos podem ver outros membros
CREATE POLICY "Active members can view members"
  ON study_group_members FOR SELECT
  USING (
    user_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM study_group_members sgm2
      JOIN study_groups sg ON sg.id = sgm2.group_id
      WHERE sgm2.group_id = study_group_members.group_id
      AND sgm2.user_id = auth.uid()
      AND sgm2.status = 'active'
      -- Garantir que o grupo permite visualização
      AND (sg.privacy_level = 'public' OR sgm2.user_id = auth.uid())
    )
  );

-- SELECT: Todos podem ver membros de grupos públicos
CREATE POLICY "Public groups members visible"
  ON study_group_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM study_groups sg
      WHERE sg.id = study_group_members.group_id
      AND sg.privacy_level = 'public'
      AND sg.archived = false
    )
  );

-- INSERT: Usuários podem solicitar entrada (status = 'requested')
CREATE POLICY "Users can request to join"
  ON study_group_members FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND auth.uid() IS NOT NULL
    AND status = 'requested'
  );

-- INSERT: Criadores/Admins podem convidar (status = 'invited')
CREATE POLICY "Admins can invite users"
  ON study_group_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM study_groups sg
      WHERE sg.id = study_group_members.group_id
      AND (sg.created_by = auth.uid() OR is_group_admin(study_group_members.group_id, auth.uid()))
    )
    AND status IN ('invited', 'active')
  );

-- UPDATE: Criadores/Admins podem aceitar pedidos
CREATE POLICY "Admins can accept requests"
  ON study_group_members FOR UPDATE
  USING (
    OLD.status = 'requested'
    AND NEW.status = 'active'
    AND (
      EXISTS (
        SELECT 1 FROM study_groups sg
        WHERE sg.id = study_group_members.group_id
        AND sg.created_by = auth.uid()
      )
      OR is_group_admin(study_group_members.group_id, auth.uid())
    )
  )
  WITH CHECK (
    NEW.status = 'active'
    AND NEW.user_id = OLD.user_id
  );

-- UPDATE: Criadores/Admins podem rejeitar pedidos
CREATE POLICY "Admins can reject requests"
  ON study_group_members FOR UPDATE
  USING (
    OLD.status = 'requested'
    AND NEW.status = 'removed'
    AND (
      EXISTS (
        SELECT 1 FROM study_groups sg
        WHERE sg.id = study_group_members.group_id
        AND sg.created_by = auth.uid()
      )
      OR is_group_admin(study_group_members.group_id, auth.uid())
    )
  );

-- UPDATE: Usuários podem aceitar convites
CREATE POLICY "Users can accept invites"
  ON study_group_members FOR UPDATE
  USING (
    OLD.status = 'invited'
    AND NEW.status = 'active'
    AND auth.uid() = user_id
  )
  WITH CHECK (
    NEW.status = 'active'
    AND auth.uid() = user_id
  );

-- Função para criar pedido de entrada
CREATE OR REPLACE FUNCTION request_to_join_group(p_group_id UUID, p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group RECORD;
  v_existing RECORD;
BEGIN
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
      -- Aceitar convite automaticamente
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

-- Função para convidar usuário
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
BEGIN
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

-- Função para aceitar/rejeitar pedido
CREATE OR REPLACE FUNCTION respond_to_join_request(
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
  -- Buscar pedido
  SELECT * INTO v_request
  FROM study_group_members
  WHERE id = p_member_id
    AND group_id = p_group_id
    AND status = 'requested';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pedido não encontrado');
  END IF;

  -- Verificar permissões
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

-- Permissões
GRANT EXECUTE ON FUNCTION request_to_join_group(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION invite_user_to_group(UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION respond_to_join_request(UUID, UUID, UUID, BOOLEAN) TO authenticated;

-- RPC para buscar pedidos pendentes de um grupo
CREATE OR REPLACE FUNCTION get_group_pending_requests(p_group_id UUID)
RETURNS TABLE(
  id UUID,
  user_id UUID,
  name TEXT,
  avatar_url TEXT,
  requested_at TIMESTAMP
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    sgm.id,
    sgm.user_id,
    up.name,
    up.avatar_url,
    sgm.joined_at as requested_at
  FROM study_group_members sgm
  JOIN users_profiles up ON up.id = sgm.user_id
  WHERE sgm.group_id = p_group_id
    AND sgm.status = 'requested'
  ORDER BY sgm.joined_at DESC;
$$;

GRANT EXECUTE ON FUNCTION get_group_pending_requests(UUID) TO authenticated;

