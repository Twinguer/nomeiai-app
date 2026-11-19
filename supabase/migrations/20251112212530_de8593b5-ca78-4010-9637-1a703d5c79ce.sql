-- Fix: Add expires_at field to send_coach_invitation function
-- The field was missing in the INSERT, causing NOT NULL constraint violation

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
  
  -- 7. Criar convite COM expires_at
  v_invitation_id := gen_random_uuid();
  
  INSERT INTO coach_invitations_history (
    id,
    coach_id,
    student_id,
    student_email,
    status,
    invitation_message,
    expires_at,
    created_at
  ) VALUES (
    v_invitation_id,
    p_coach_id,
    v_student_id,
    v_student_email,
    'pending',
    p_invitation_message,
    NOW() + INTERVAL '30 days',  -- FIX: Campo expires_at estava faltando
    NOW()
  );
  
  -- 8. Criar notificação para o aluno
  INSERT INTO notifications (
    user_id,
    type,
    title,
    message,
    metadata
  ) VALUES (
    v_student_id,
    'coach_invitation',
    'Convite de Coach',
    COALESCE(v_coach_name, 'Um coach') || ' quer te convidar para sua equipe de estudos',
    jsonb_build_object(
      'invitation_id', v_invitation_id,
      'coach_id', p_coach_id,
      'coach_name', v_coach_name
    )
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Convite enviado com sucesso',
    'invitation_id', v_invitation_id
  );
END;
$$;

COMMENT ON FUNCTION send_coach_invitation(UUID, TEXT, TEXT) IS 
  'Envia convite de coach usando nickname. Verifica se aluno tem Plano Pro. FIX: Inclui expires_at obrigatório.';