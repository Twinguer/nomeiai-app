-- ============================================
-- Migration: Sistema de Nicknames e Convites Coach
-- Data: 2025-02-02
-- Objetivo: Tornar nickname único/obrigatório e criar função send_coach_invitation
-- ============================================

-- 1. Criar função para gerar nickname único baseado no nome
CREATE OR REPLACE FUNCTION generate_unique_nickname(base_name TEXT)
RETURNS TEXT AS $$
DECLARE
  clean_name TEXT;
  nickname_candidate TEXT;
  counter INTEGER := 0;
  max_attempts INTEGER := 1000;
BEGIN
  -- Limpar nome: remover espaços, caracteres especiais, converter para minúsculas
  clean_name := LOWER(REGEXP_REPLACE(
    base_name,
    '[^a-z0-9]',
    '',
    'g'
  ));
  
  -- Garantir mínimo de 3 caracteres
  IF LENGTH(clean_name) < 3 THEN
    clean_name := clean_name || '123';
  END IF;
  
  -- Limitar a 20 caracteres
  clean_name := SUBSTRING(clean_name, 1, 20);
  
  -- Tentar nickname base
  nickname_candidate := clean_name;
  
  -- Verificar unicidade e adicionar sufixo numérico se necessário
  WHILE EXISTS (
    SELECT 1 FROM users_profiles 
    WHERE LOWER(nickname) = LOWER(nickname_candidate)
  ) AND counter < max_attempts LOOP
    counter := counter + 1;
    nickname_candidate := clean_name || counter::TEXT;
    
    -- Garantir que não ultrapasse 20 caracteres
    IF LENGTH(nickname_candidate) > 20 THEN
      nickname_candidate := SUBSTRING(clean_name, 1, 20 - LENGTH(counter::TEXT)) || counter::TEXT;
    END IF;
  END LOOP;
  
  RETURN nickname_candidate;
END;
$$ LANGUAGE plpgsql;

-- 2. Atualizar usuários existentes sem nickname
UPDATE users_profiles
SET nickname = generate_unique_nickname(COALESCE(name, email))
WHERE nickname IS NULL OR TRIM(nickname) = '';

-- 3. Corrigir nicknames duplicados (manter o primeiro, alterar os demais)
DO $$
DECLARE
  user_rec RECORD;
  new_nickname TEXT;
BEGIN
  FOR user_rec IN 
    SELECT id, nickname, name, email, created_at
    FROM users_profiles
    WHERE nickname IS NOT NULL
    ORDER BY created_at
  LOOP
    -- Se nickname já existe em outro usuário (mais antigo)
    IF EXISTS (
      SELECT 1 FROM users_profiles 
      WHERE LOWER(nickname) = LOWER(user_rec.nickname)
      AND id != user_rec.id
      AND created_at < user_rec.created_at
    ) THEN
      -- Gerar novo nickname único
      new_nickname := generate_unique_nickname(
        COALESCE(user_rec.name, user_rec.email)
      );
      
      -- Atualizar com novo nickname
      UPDATE users_profiles
      SET nickname = new_nickname
      WHERE id = user_rec.id;
    END IF;
  END LOOP;
END;
$$;

-- 4. Normalizar todos os nicknames para minúsculas (para consistência)
UPDATE users_profiles
SET nickname = LOWER(TRIM(nickname))
WHERE nickname IS NOT NULL;

-- 5. Remover constraint antiga se existir e criar novas
ALTER TABLE users_profiles
  DROP CONSTRAINT IF EXISTS unique_nickname,
  DROP CONSTRAINT IF EXISTS check_nickname_format;

-- 6. Tornar nickname obrigatório e único (case-insensitive)
ALTER TABLE users_profiles
  ALTER COLUMN nickname SET NOT NULL,
  ADD CONSTRAINT unique_nickname UNIQUE (nickname);

-- 7. Criar índice case-insensitive para busca rápida
CREATE INDEX IF NOT EXISTS idx_users_profiles_nickname_lower 
  ON users_profiles(LOWER(nickname));

-- 8. Criar constraint para validar formato (apenas letras minúsculas, números e underscore, 3-20 caracteres)
ALTER TABLE users_profiles
  ADD CONSTRAINT check_nickname_format 
  CHECK (
    nickname ~ '^[a-z0-9_]{3,20}$'
    AND LENGTH(nickname) >= 3
    AND LENGTH(nickname) <= 20
  );

-- ============================================
-- 9. FUNÇÃO RPC: send_coach_invitation
-- ============================================
CREATE OR REPLACE FUNCTION send_coach_invitation(
  p_coach_id UUID,
  p_student_nickname TEXT,  -- MUDANÇA: nickname em vez de email
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
BEGIN
  -- Limpar nickname (remover espaços e converter para minúsculas)
  v_student_nickname_clean := LOWER(TRIM(p_student_nickname));
  
  -- Remover @ se presente
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
  
  -- 2. Buscar aluno pelo nickname (sem expor email ainda)
  SELECT id, email INTO v_student_id, v_student_email
  FROM users_profiles
  WHERE LOWER(nickname) = v_student_nickname_clean;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Usuário não encontrado com este nickname'
    );
  END IF;
  
  -- 3. Verificar se já existe convite pendente
  IF EXISTS (
    SELECT 1 FROM coach_invitations_history
    WHERE coach_id = p_coach_id
      AND student_id = v_student_id
      AND status = 'pending'
      AND expires_at > NOW()
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Já existe um convite pendente para este aluno'
    );
  END IF;
  
  -- 4. Verificar se já é aluno do coach
  IF EXISTS (
    SELECT 1 FROM coach_profiles cp
    WHERE cp.coach_id = p_coach_id
      AND (
        SELECT COUNT(*) FROM jsonb_array_elements(cp.student_relationships)
        WHERE (value->>'student_id')::uuid = v_student_id
        AND (value->>'status')::text = 'active'
      ) > 0
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Este usuário já é seu aluno'
    );
  END IF;
  
  -- 5. Buscar nome do coach
  SELECT name INTO v_coach_name
  FROM users_profiles
  WHERE id = p_coach_id;
  
  -- 6. Criar convite no histórico
  INSERT INTO coach_invitations_history (
    coach_id,
    student_id,
    student_email,  -- Armazenado internamente
    invitation_message,
    status,
    expires_at
  ) VALUES (
    p_coach_id,
    v_student_id,
    v_student_email,  -- Email usado internamente
    p_invitation_message,
    'pending',
    NOW() + INTERVAL '30 days'
  )
  RETURNING id INTO v_invitation_id;
  
  -- 7. Criar notificação
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
  
  -- 8. Chamar edge function para enviar email (via HTTP usando pg_net ou similar)
  -- Nota: O email será enviado pela edge function que busca o email do convite
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Convite enviado com sucesso',
    'invitation_id', v_invitation_id,
    'student_id', v_student_id
  );
END;
$$;

-- 10. Permissões
GRANT EXECUTE ON FUNCTION send_coach_invitation(UUID, TEXT, TEXT) TO authenticated;

-- 11. Comentários
COMMENT ON FUNCTION send_coach_invitation IS 'Envia convite de coach usando nickname do aluno (não expõe email)';
COMMENT ON CONSTRAINT unique_nickname ON users_profiles IS 'Nickname único e obrigatório para identificação segura de usuários';
COMMENT ON CONSTRAINT check_nickname_format ON users_profiles IS 'Valida formato do nickname: apenas a-z, 0-9, underscore, 3-20 caracteres';

