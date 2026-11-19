-- ============================================================================
-- MIGRATION: Exigir Plano Pro para Grupos e Convites de Coach
-- DATA: 2025-01-08
-- OBJETIVO: Apenas usuários com Plano Pro podem participar de grupos e ser convidados por Coach
-- ============================================================================

-- ============================================================================
-- 1. ATUALIZAR request_to_join_group - APENAS PRO
-- ============================================================================

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
  -- VALIDAÇÃO: Verificar se usuário tem Plano Pro
  v_user_plan := public.get_user_subscription_plan(p_user_id);
  IF v_user_plan IS NULL THEN
    v_user_plan := 'free'::subscription_plan;
  END IF;

  -- APENAS Pro pode entrar em grupos (Coach NÃO pode)
  IF v_user_plan != 'pro'::subscription_plan THEN
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
    ELSIF v_existing.status = 'invited' THEN
      -- Aceitar convite pendente
      UPDATE study_group_members
      SET status = 'active', joined_at = NOW()
      WHERE id = v_existing.id;
      RETURN jsonb_build_object('success', true, 'message', 'Convite aceito');
    ELSE
      -- Reativar membro
      UPDATE study_group_members
      SET status = 'active', joined_at = NOW()
      WHERE id = v_existing.id;
      RETURN jsonb_build_object('success', true, 'message', 'Entrada no grupo confirmada');
    END IF;
  END IF;

  -- Criar solicitação
  INSERT INTO study_group_members (group_id, user_id, status, role)
  VALUES (p_group_id, p_user_id, 'pending', 'member')
  ON CONFLICT (group_id, user_id) DO UPDATE
  SET status = 'pending';

  RETURN jsonb_build_object('success', true, 'message', 'Solicitação enviada');
END;
$$;

-- ============================================================================
-- 2. ATUALIZAR invite_user_to_group - APENAS PRO
-- ============================================================================

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
  -- VALIDAÇÃO: Verificar se usuário convidado tem Plano Pro
  v_user_plan := public.get_user_subscription_plan(p_user_id);
  IF v_user_plan IS NULL THEN
    v_user_plan := 'free'::subscription_plan;
  END IF;

  -- APENAS Pro pode ser convidado para grupos (Coach NÃO pode)
  IF v_user_plan != 'pro'::subscription_plan THEN
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

-- ============================================================================
-- 3. ATUALIZAR add_student_to_coach - VERIFICAR SE ALUNO TEM PRO
-- ============================================================================

CREATE OR REPLACE FUNCTION add_student_to_coach(
  p_coach_id UUID,
  p_student_id UUID,
  p_consent_data JSONB DEFAULT '{}'::jsonb
) RETURNS JSONB AS $$
DECLARE
  v_subscription RECORD;
  v_profile RECORD;
  v_new_relationship JSONB;
  v_relationship_id UUID;
  v_student_plan subscription_plan;
BEGIN
  -- VALIDAÇÃO: Verificar se aluno tem Plano Pro
  v_student_plan := public.get_user_subscription_plan(p_student_id);
  IF v_student_plan IS NULL THEN
    v_student_plan := 'free'::subscription_plan;
  END IF;

  -- APENAS alunos com Plano Pro podem ser convidados por Coach
  IF v_student_plan != 'pro'::subscription_plan THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Apenas usuários com Plano Pro podem ser convidados por um Coach. O aluno precisa fazer upgrade para Pro.',
      'requires_upgrade', true
    );
  END IF;

  -- 1. Validar assinatura do Coach
  SELECT max_students, current_students
  INTO v_subscription
  FROM coach_subscriptions
  WHERE coach_id = p_coach_id AND status = 'active';
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Coach não possui assinatura ativa'
    );
  END IF;
  
  -- 2. Validar limite
  IF v_subscription.current_students >= v_subscription.max_students THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Limite de %s alunos atingido', v_subscription.max_students)
    );
  END IF;
  
  -- 3. Buscar/criar perfil
  SELECT * INTO v_profile FROM coach_profiles
  WHERE coach_id = p_coach_id FOR UPDATE;
  
  IF NOT FOUND THEN
    INSERT INTO coach_profiles (coach_id, student_relationships)
    VALUES (p_coach_id, '[]'::jsonb)
    RETURNING * INTO v_profile;
  END IF;
  
  -- 4. Verificar se já existe relacionamento
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_profile.student_relationships) AS rel
    WHERE (rel->>'student_id')::uuid = p_student_id
      AND (rel->>'status')::text = 'active'
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Aluno já está na equipe deste Coach'
    );
  END IF;
  
  -- 5. Criar relacionamento
  v_relationship_id := gen_random_uuid();
  
  v_new_relationship := jsonb_build_object(
    'relationship_id', v_relationship_id,
    'student_id', p_student_id,
    'status', 'active',
    'consent_data', p_consent_data,
    'joined_at', NOW(),
    'last_activity', NOW(),
    'notes', '',
    'performance', jsonb_build_object(
      'hours_this_week', 0,
      'hours_last_week', 0,
      'sessions_this_week', 0,
      'tasks_completed', 0,
      'tasks_pending', 0,
      'completion_rate', 0,
      'engagement_score', 0
    )
  );
  
  -- 6. Adicionar ao array
  UPDATE coach_profiles
  SET 
    student_relationships = student_relationships || jsonb_build_array(v_new_relationship),
    updated_at = NOW()
  WHERE coach_id = p_coach_id;
  
  -- 7. Incrementar contador
  UPDATE coach_subscriptions
  SET 
    current_students = current_students + 1,
    updated_at = NOW()
  WHERE coach_id = p_coach_id;
  
  -- 8. Log de auditoria
  INSERT INTO coach_access_logs (
    coach_id,
    student_id,
    action_type,
    accessed_data_category
  ) VALUES (
    p_coach_id,
    p_student_id,
    'student_added',
    'team_management'
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Aluno adicionado à equipe com sucesso',
    'relationship_id', v_relationship_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================================
-- 4. ATUALIZAR send_coach_invitation - VERIFICAR SE ALUNO TEM PRO
-- ============================================================================

CREATE OR REPLACE FUNCTION send_coach_invitation(
  p_coach_id UUID,
  p_student_nickname TEXT,
  p_invitation_message TEXT DEFAULT NULL
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_student_id UUID;
  v_student_email TEXT;
  v_coach_name TEXT;
  v_invitation_id UUID;
  v_student_nickname_clean TEXT;
  v_can_invite JSONB;
  v_student_plan subscription_plan;
BEGIN
  -- Limpar nickname
  v_student_nickname_clean := LOWER(TRIM(p_student_nickname));
  
  IF v_student_nickname_clean LIKE '@%' THEN
    v_student_nickname_clean := SUBSTRING(v_student_nickname_clean, 2);
  END IF;
  
  -- Validar formato do nickname
  IF NOT (v_student_nickname_clean ~ '^[a-z0-9_]{3,20}$') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Nickname inválido. Use apenas letras minúsculas, números e underscore (3-20 caracteres)'
    );
  END IF;
  
  -- 1. Verificar se pode convidar
  SELECT check_if_can_invite_student(p_coach_id) INTO v_can_invite;
  
  IF NOT (v_can_invite->>'can_invite')::boolean THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', COALESCE(v_can_invite->>'reason', 'Não é possível convidar no momento')
    );
  END IF;
  
  -- 2. Buscar aluno pelo nickname
  SELECT id, email INTO v_student_id, v_student_email
  FROM users_profiles
  WHERE LOWER(nickname) = v_student_nickname_clean;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Usuário não encontrado com este nickname'
    );
  END IF;

  -- 3. VALIDAÇÃO: Verificar se aluno tem Plano Pro
  v_student_plan := public.get_user_subscription_plan(v_student_id);
  IF v_student_plan IS NULL THEN
    v_student_plan := 'free'::subscription_plan;
  END IF;

  -- APENAS alunos com Plano Pro podem ser convidados
  IF v_student_plan != 'pro'::subscription_plan THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Apenas usuários com Plano Pro podem ser convidados por um Coach. O aluno precisa fazer upgrade para Pro.',
      'requires_upgrade', true
    );
  END IF;
  
  -- 4. Verificar se já existe convite pendente
  IF EXISTS (
    SELECT 1 FROM coach_invitations_history
    WHERE coach_id = p_coach_id
      AND student_id = v_student_id
      AND status = 'pending'
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Já existe um convite pendente para este aluno'
    );
  END IF;
  
  -- 5. Verificar se já está na equipe
  IF EXISTS (
    SELECT 1 FROM coach_profiles cp
    WHERE cp.coach_id = p_coach_id
      AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(cp.student_relationships) AS rel
        WHERE (rel->>'student_id')::uuid = v_student_id
          AND (rel->>'status')::text = 'active'
      )
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Aluno já está na sua equipe'
    );
  END IF;
  
  -- 6. Obter nome do Coach
  SELECT COALESCE(up.name, au.email) INTO v_coach_name
  FROM auth.users au
  LEFT JOIN users_profiles up ON au.id = up.id
  WHERE au.id = p_coach_id;
  
  -- 7. Criar convite
  v_invitation_id := gen_random_uuid();
  
  INSERT INTO coach_invitations_history (
    id,
    coach_id,
    student_id,
    student_email,
    status,
    invitation_message,
    created_at
  ) VALUES (
    v_invitation_id,
    p_coach_id,
    v_student_id,
    v_student_email,
    'pending',
    p_invitation_message,
    NOW()
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Convite enviado com sucesso',
    'invitation_id', v_invitation_id
  );
END;
$$;

-- ============================================================================
-- 5. ATUALIZAR RLS POLICIES - APENAS PRO
-- ============================================================================

-- Atualizar policy para criação de grupos (APENAS Pro, não Coach)
DROP POLICY IF EXISTS "only_pro_or_coach_users_can_create_groups" ON public.study_groups;
DROP POLICY IF EXISTS "only_pro_users_can_create_groups" ON public.study_groups;

CREATE POLICY "only_pro_users_can_create_groups"
  ON public.study_groups FOR INSERT
  WITH CHECK (
    auth.uid() = created_by
    AND (
      public.is_user_pro(auth.uid())
      OR public.has_role(auth.uid(), 'admin'::app_role)
    )
  );

-- Atualizar policy para participação em grupos (APENAS Pro, não Coach)
DROP POLICY IF EXISTS "only_pro_or_coach_users_can_join_groups" ON public.study_group_members;
DROP POLICY IF EXISTS "only_pro_users_can_join_groups" ON public.study_group_members;

CREATE POLICY "only_pro_users_can_join_groups"
  ON public.study_group_members FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (
      public.is_user_pro(auth.uid())
      OR public.has_role(auth.uid(), 'admin'::app_role)
    )
  );

-- Atualizar policy para visualização de grupos (APENAS Pro, não Coach)
DROP POLICY IF EXISTS "only_pro_or_coach_can_view_groups" ON public.study_groups;

CREATE POLICY "only_pro_can_view_groups"
  ON public.study_groups FOR SELECT
  USING (
    public.is_user_pro(auth.uid())
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

-- Atualizar policy para visualização de membros (APENAS Pro, não Coach)
DROP POLICY IF EXISTS "only_pro_or_coach_can_view_group_members" ON public.study_group_members;

CREATE POLICY "only_pro_can_view_group_members"
  ON public.study_group_members FOR SELECT
  USING (
    public.is_user_pro(auth.uid())
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

-- ============================================================================
-- 6. COMENTÁRIOS
-- ============================================================================

COMMENT ON FUNCTION request_to_join_group(UUID, UUID) IS 
  'Solicita entrada em um grupo de estudos. APENAS usuários com Plano Pro podem participar. Coach NÃO pode.';

COMMENT ON FUNCTION invite_user_to_group(UUID, UUID, UUID) IS 
  'Convida um usuário para um grupo de estudos. APENAS usuários com Plano Pro podem ser convidados. Coach NÃO pode.';

COMMENT ON FUNCTION add_student_to_coach(UUID, UUID, JSONB) IS 
  'Adiciona um aluno à equipe do Coach. APENAS alunos com Plano Pro podem ser adicionados.';

COMMENT ON FUNCTION send_coach_invitation(UUID, TEXT, TEXT) IS 
  'Envia convite de Coach para um aluno. APENAS alunos com Plano Pro podem receber convites.';

