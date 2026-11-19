-- ============================================================================
-- MIGRATION: Adicionar validação de Coach para grupos
-- DATA: 2025-02-06
-- OBJETIVO: Permitir que Coaches também possam participar e criar grupos
-- ============================================================================

-- Função: Verificar se usuário é Coach (tem assinatura ativa)
CREATE OR REPLACE FUNCTION public.is_user_coach(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM coach_subscriptions
    WHERE coach_id = p_user_id
      AND status = 'active'
      AND (expires_at IS NULL OR expires_at > NOW())
  );
$$;

-- Função: Verificar se usuário atual é Coach
CREATE OR REPLACE FUNCTION public.is_current_user_coach()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_user_coach(auth.uid());
$$;

-- Função: Verificar se usuário é Pro ou Coach
CREATE OR REPLACE FUNCTION public.is_user_pro_or_coach(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    public.is_user_pro(p_user_id)
    OR public.is_user_coach(p_user_id);
$$;

-- Atualizar função request_to_join_group para permitir Coach
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
  v_is_coach BOOLEAN;
BEGIN
  -- VALIDAÇÃO: Verificar plano do usuário e se é Coach
  v_user_plan := public.get_user_subscription_plan(p_user_id);
  IF v_user_plan IS NULL THEN
    v_user_plan := 'free'::subscription_plan;
  END IF;

  v_is_coach := public.is_user_coach(p_user_id);

  -- Free não pode entrar em grupos (apenas Pro ou Coach)
  IF v_user_plan = 'free' AND NOT v_is_coach THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Grupos de estudos estão disponíveis apenas no plano Pro ou Modo Coach. Faça upgrade para participar de grupos.',
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

-- Atualizar função invite_user_to_group para permitir Coach
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
  v_is_coach BOOLEAN;
BEGIN
  -- VALIDAÇÃO: Verificar plano do usuário convidado e se é Coach
  v_user_plan := public.get_user_subscription_plan(p_user_id);
  IF v_user_plan IS NULL THEN
    v_user_plan := 'free'::subscription_plan;
  END IF;

  v_is_coach := public.is_user_coach(p_user_id);

  -- Free não pode ser convidado para grupos (apenas Pro ou Coach)
  IF v_user_plan = 'free' AND NOT v_is_coach THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Usuários do plano Free não podem participar de grupos. O usuário precisa fazer upgrade para Pro ou ter assinatura do Modo Coach.',
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

-- Atualizar RLS Policy para criação de grupos (Pro ou Coach)
DROP POLICY IF EXISTS "only_pro_users_can_create_groups" ON public.study_groups;

CREATE POLICY "only_pro_or_coach_users_can_create_groups"
  ON public.study_groups FOR INSERT
  WITH CHECK (
    auth.uid() = created_by
    AND (
      public.is_user_pro(auth.uid())
      OR public.is_user_coach(auth.uid())
      OR public.has_role(auth.uid(), 'admin'::app_role)
    )
  );

-- Atualizar RLS Policy para participação em grupos (Pro ou Coach)
DROP POLICY IF EXISTS "only_pro_users_can_join_groups" ON public.study_group_members;

CREATE POLICY "only_pro_or_coach_users_can_join_groups"
  ON public.study_group_members FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (
      public.is_user_pro(auth.uid())
      OR public.is_user_coach(auth.uid())
      OR public.has_role(auth.uid(), 'admin'::app_role)
    )
  );

-- Comentários
COMMENT ON FUNCTION public.is_user_coach(UUID) IS 
  'Verifica se o usuário possui assinatura ativa do Modo Coach.';

COMMENT ON FUNCTION public.is_user_pro_or_coach(UUID) IS 
  'Verifica se o usuário possui plano Pro ou assinatura ativa do Modo Coach.';

COMMENT ON FUNCTION request_to_join_group(UUID, UUID) IS 
  'Solicita entrada em um grupo de estudos. Bloqueia usuários Free - apenas Pro ou Coach pode participar de grupos.';

COMMENT ON FUNCTION invite_user_to_group(UUID, UUID, UUID) IS 
  'Convida um usuário para um grupo de estudos. Bloqueia convites para usuários Free - apenas Pro ou Coach pode ser convidado.';



