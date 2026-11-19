-- ============================================
-- COACH MODE - Estrutura Completa
-- Data: 2025-01-27
-- ============================================

-- ============================================
-- 1. TABELA PRINCIPAL (1 linha por coach)
-- ============================================
CREATE TABLE IF NOT EXISTS coach_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Arrays JSONB principais
  student_relationships JSONB NOT NULL DEFAULT '[]'::jsonb,
  coach_tasks JSONB NOT NULL DEFAULT '[]'::jsonb,
  pending_invitations JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Objects JSONB
  team_statistics JSONB NOT NULL DEFAULT '{}'::jsonb,
  alerts JSONB NOT NULL DEFAULT '[]'::jsonb,
  coach_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Colunas simples (contadores computados)
  last_activity_date DATE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Índices GIN para performance
CREATE INDEX idx_coach_profiles_relationships ON coach_profiles 
  USING GIN (student_relationships);
CREATE INDEX idx_coach_profiles_tasks ON coach_profiles 
  USING GIN (coach_tasks);
CREATE INDEX idx_coach_profiles_invitations ON coach_profiles 
  USING GIN (pending_invitations);
CREATE INDEX idx_coach_profiles_alerts ON coach_profiles 
  USING GIN (alerts);

-- ============================================
-- 2. TABELA DE ASSINATURA (1:1 com coach)
-- ============================================
CREATE TABLE IF NOT EXISTS coach_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  plan_type TEXT NOT NULL CHECK (plan_type IN ('starter', 'professional', 'enterprise')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'suspended', 'expired')),
  
  max_students INTEGER NOT NULL,
  current_students INTEGER DEFAULT 0,
  
  price DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP
);

-- Índices
CREATE INDEX idx_coach_subscriptions_coach_id ON coach_subscriptions(coach_id);
CREATE INDEX idx_coach_subscriptions_status ON coach_subscriptions(status);

-- ============================================
-- 3. TABELA DE AUDITORIA
-- ============================================
CREATE TABLE IF NOT EXISTS coach_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  action_type TEXT NOT NULL,
  accessed_data_category TEXT,
  
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMP DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_access_logs_coach_student ON coach_access_logs(coach_id, student_id);
CREATE INDEX idx_access_logs_created ON coach_access_logs(created_at DESC);
CREATE INDEX idx_access_logs_action ON coach_access_logs(action_type);

-- ============================================
-- 4. TABELA DE HISTÓRICO DE CONVITES (LGPD)
-- ============================================
CREATE TABLE IF NOT EXISTS coach_invitations_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  student_email TEXT NOT NULL,
  student_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  invitation_message TEXT,
  consent_data JSONB DEFAULT '{}'::jsonb,
  
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
  relationship_id UUID, -- Se aceito, link para relacionamento
  
  expires_at TIMESTAMP NOT NULL,
  invited_at TIMESTAMP DEFAULT NOW(),
  responded_at TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_invitations_coach ON coach_invitations_history(coach_id);
CREATE INDEX idx_invitations_student ON coach_invitations_history(student_id);
CREATE INDEX idx_invitations_status ON coach_invitations_history(status);
CREATE INDEX idx_invitations_expires ON coach_invitations_history(expires_at);

-- ============================================
-- 5. RLS (Row Level Security)
-- ============================================
ALTER TABLE coach_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach_access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach_invitations_history ENABLE ROW LEVEL SECURITY;

-- Políticas para coach_profiles
CREATE POLICY "Coaches can manage own profile"
  ON coach_profiles FOR ALL
  USING (auth.uid() = coach_id)
  WITH CHECK (auth.uid() = coach_id);

-- Políticas para coach_subscriptions
CREATE POLICY "Coaches can view own subscription"
  ON coach_subscriptions FOR SELECT
  USING (auth.uid() = coach_id);

CREATE POLICY "Coaches can update own subscription"
  ON coach_subscriptions FOR UPDATE
  USING (auth.uid() = coach_id);

-- Políticas para coach_access_logs
CREATE POLICY "Coaches can view own logs"
  ON coach_access_logs FOR SELECT
  USING (auth.uid() = coach_id);

-- Políticas para coach_invitations_history
CREATE POLICY "Coaches can view own invitations"
  ON coach_invitations_history FOR SELECT
  USING (auth.uid() = coach_id);

CREATE POLICY "Students can view invitations for them"
  ON coach_invitations_history FOR SELECT
  USING (
    auth.uid() = student_id 
    OR student_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- ============================================
-- 6. FUNÇÕES RPC ESSENCIAIS
-- ============================================

-- Função: Verificar se pode adicionar aluno
CREATE OR REPLACE FUNCTION check_if_can_invite_student(
  p_coach_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_subscription RECORD;
BEGIN
  SELECT max_students, current_students, status
  INTO v_subscription
  FROM coach_subscriptions
  WHERE coach_id = p_coach_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'can_invite', false,
      'reason', 'Sem assinatura ativa'
    );
  END IF;
  
  IF v_subscription.status != 'active' THEN
    RETURN jsonb_build_object(
      'can_invite', false,
      'reason', 'Assinatura inativa'
    );
  END IF;
  
  IF v_subscription.current_students >= v_subscription.max_students THEN
    RETURN jsonb_build_object(
      'can_invite', false,
      'reason', 'Limite atingido',
      'current', v_subscription.current_students,
      'max', v_subscription.max_students,
      'slots_free', 0
    );
  END IF;
  
  RETURN jsonb_build_object(
    'can_invite', true,
    'current', v_subscription.current_students,
    'max', v_subscription.max_students,
    'slots_free', v_subscription.max_students - v_subscription.current_students
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Função: Adicionar aluno ao coach
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
BEGIN
  -- 1. Validar assinatura
  SELECT max_students, current_students
  INTO v_subscription
  FROM coach_subscriptions
  WHERE coach_id = p_coach_id AND status = 'active';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Coach não possui assinatura ativa';
  END IF;
  
  -- 2. Validar limite
  IF v_subscription.current_students >= v_subscription.max_students THEN
    RAISE EXCEPTION 'Limite de % alunos atingido', v_subscription.max_students;
  END IF;
  
  -- 3. Buscar/criar perfil
  SELECT * INTO v_profile FROM coach_profiles
  WHERE coach_id = p_coach_id FOR UPDATE;
  
  IF NOT FOUND THEN
    INSERT INTO coach_profiles (coach_id, student_relationships)
    VALUES (p_coach_id, '[]'::jsonb)
    RETURNING * INTO v_profile;
  END IF;
  
  -- 4. Criar relacionamento
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
  
  -- 5. Adicionar ao array
  UPDATE coach_profiles
  SET 
    student_relationships = student_relationships || jsonb_build_array(v_new_relationship),
    updated_at = NOW()
  WHERE coach_id = p_coach_id;
  
  -- 6. Incrementar contador
  UPDATE coach_subscriptions
  SET 
    current_students = current_students + 1,
    updated_at = NOW()
  WHERE coach_id = p_coach_id;
  
  -- 7. Log de auditoria
  INSERT INTO coach_access_logs (
    coach_id,
    student_id,
    action_type,
    accessed_data_category
  ) VALUES (
    p_coach_id,
    p_student_id,
    'student_added',
    'relationship_created'
  );
  
  RETURN v_new_relationship;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Função: Remover aluno do coach
CREATE OR REPLACE FUNCTION remove_student_from_coach(
  p_coach_id UUID,
  p_student_id UUID
) RETURNS VOID AS $$
DECLARE
  v_updated JSONB;
BEGIN
  -- Remover do array
  UPDATE coach_profiles
  SET 
    student_relationships = (
      SELECT jsonb_agg(rel)
      FROM jsonb_array_elements(student_relationships) AS rel
      WHERE (rel->>'student_id')::text != p_student_id::text
    ),
    updated_at = NOW()
  WHERE coach_id = p_coach_id;
  
  -- Decrementar contador
  UPDATE coach_subscriptions
  SET 
    current_students = GREATEST(0, current_students - 1),
    updated_at = NOW()
  WHERE coach_id = p_coach_id;
  
  -- Log
  INSERT INTO coach_access_logs (
    coach_id,
    student_id,
    action_type,
    accessed_data_category
  ) VALUES (
    p_coach_id,
    p_student_id,
    'student_removed',
    'relationship_deleted'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ============================================
-- 7. TRIGGERS
-- ============================================

-- Trigger: Atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_coach_profiles_updated_at
  BEFORE UPDATE ON coach_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_coach_subscriptions_updated_at
  BEFORE UPDATE ON coach_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- COMENTÁRIOS PARA DOCUMENTAÇÃO
-- ============================================
COMMENT ON TABLE coach_profiles IS 'Perfil do coach com todos os dados em JSONB - 1 linha por coach';
COMMENT ON TABLE coach_subscriptions IS 'Assinatura do coach - controle de plano e limites';
COMMENT ON TABLE coach_access_logs IS 'Auditoria de acessos do coach (LGPD compliance)';
COMMENT ON TABLE coach_invitations_history IS 'Histórico de convites enviados (LGPD compliance)';


