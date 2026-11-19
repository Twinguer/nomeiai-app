-- =====================================================
-- MIGRATION: Nova Estrutura Normalizada de Rankings
-- OBJETIVO: Otimizar para 5.000 usuários ativos
-- DATA: 2025-01-15
-- =====================================================

-- 1. RANKINGS (dados principais)
-- =====================================================
CREATE TABLE IF NOT EXISTS rankings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  orgao TEXT NOT NULL,
  banca TEXT NOT NULL,
  exam_type TEXT NOT NULL DEFAULT 'Alternativas',
  has_minimum_score BOOLEAN DEFAULT false,
  total_minimum_score NUMERIC DEFAULT 0,
  total_participants INTEGER DEFAULT 0,
  status TEXT DEFAULT 'Ativo' CHECK (status IN ('Ativo', 'Finalizado', 'Inativo')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. USER_RANKINGS (participações)
-- =====================================================
CREATE TABLE IF NOT EXISTS user_rankings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ranking_id UUID NOT NULL REFERENCES rankings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score NUMERIC DEFAULT 0,
  position INTEGER DEFAULT 0,
  reservation_type TEXT DEFAULT 'Ampla Concorrência',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(ranking_id, user_id)
);

-- 3. USER_ANSWERS (respostas individuais)
-- =====================================================
CREATE TABLE IF NOT EXISTS user_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ranking_id UUID NOT NULL REFERENCES rankings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  booklet_id TEXT NOT NULL,
  question_number INTEGER NOT NULL,
  user_answer TEXT,
  is_correct BOOLEAN DEFAULT false,
  points_earned NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(ranking_id, user_id, booklet_id, question_number)
);

-- 4. RANKING_ANSWERS (gabarito oficial)
-- =====================================================
CREATE TABLE IF NOT EXISTS ranking_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ranking_id UUID NOT NULL REFERENCES rankings(id) ON DELETE CASCADE,
  booklet_id TEXT NOT NULL,
  question_number INTEGER NOT NULL,
  correct_answer TEXT NOT NULL,
  weight NUMERIC DEFAULT 1.0,
  is_nullified BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(ranking_id, booklet_id, question_number)
);

-- 5. RANKING_DISCIPLINES (disciplinas e pesos)
-- =====================================================
CREATE TABLE IF NOT EXISTS ranking_disciplines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ranking_id UUID NOT NULL REFERENCES rankings(id) ON DELETE CASCADE,
  discipline_id TEXT NOT NULL,
  discipline_name TEXT NOT NULL,
  minimum_score NUMERIC DEFAULT 0,
  weight NUMERIC DEFAULT 1.0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(ranking_id, discipline_id)
);

-- 6. USERS_PROFILES (perfis públicos) - já existe, vamos apenas verificar
-- =====================================================
-- Esta tabela já existe, não precisamos recriar

-- ÍNDICES DE PERFORMANCE
-- =====================================================

-- Índices para user_rankings (queries mais frequentes)
CREATE INDEX IF NOT EXISTS idx_user_rankings_ranking_score 
  ON user_rankings (ranking_id, score DESC);

CREATE INDEX IF NOT EXISTS idx_user_rankings_ranking_position 
  ON user_rankings (ranking_id, position);

CREATE INDEX IF NOT EXISTS idx_user_rankings_user_id 
  ON user_rankings (user_id);

-- Índices para user_answers
CREATE INDEX IF NOT EXISTS idx_user_answers_ranking_user 
  ON user_answers (ranking_id, user_id);

CREATE INDEX IF NOT EXISTS idx_user_answers_ranking_question 
  ON user_answers (ranking_id, booklet_id, question_number);

CREATE INDEX IF NOT EXISTS idx_user_answers_user_id 
  ON user_answers (user_id);

-- Índices para ranking_answers
CREATE INDEX IF NOT EXISTS idx_ranking_answers_ranking_booklet 
  ON ranking_answers (ranking_id, booklet_id);

CREATE INDEX IF NOT EXISTS idx_ranking_answers_ranking 
  ON ranking_answers (ranking_id);

-- Índices para ranking_disciplines
CREATE INDEX IF NOT EXISTS idx_ranking_disciplines_ranking 
  ON ranking_disciplines (ranking_id);

-- Índices para rankings
CREATE INDEX IF NOT EXISTS idx_rankings_status 
  ON rankings (status);

CREATE INDEX IF NOT EXISTS idx_rankings_created_at 
  ON rankings (created_at DESC);

-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE rankings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_rankings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE ranking_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE ranking_disciplines ENABLE ROW LEVEL SECURITY;

-- Políticas de segurança para rankings
CREATE POLICY "rankings_public_read" ON rankings 
  FOR SELECT USING (true);

CREATE POLICY "rankings_authenticated_insert" ON rankings 
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "rankings_owner_update" ON rankings 
  FOR UPDATE USING (auth.uid() IS NOT NULL);

-- Políticas para user_rankings
CREATE POLICY "user_rankings_public_read" ON user_rankings 
  FOR SELECT USING (true);

CREATE POLICY "user_rankings_own_data" ON user_rankings 
  FOR ALL USING (auth.uid() = user_id);

-- Políticas para user_answers
CREATE POLICY "user_answers_own_data" ON user_answers 
  FOR ALL USING (auth.uid() = user_id);

-- Políticas para ranking_answers
CREATE POLICY "ranking_answers_public_read" ON ranking_answers 
  FOR SELECT USING (true);

CREATE POLICY "ranking_answers_authenticated_insert" ON ranking_answers 
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Políticas para ranking_disciplines
CREATE POLICY "ranking_disciplines_public_read" ON ranking_disciplines 
  FOR SELECT USING (true);

CREATE POLICY "ranking_disciplines_authenticated_insert" ON ranking_disciplines 
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- FUNÇÕES AUXILIARES
-- =====================================================

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at
CREATE TRIGGER update_rankings_updated_at
  BEFORE UPDATE ON rankings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Função para recalcular posições automaticamente
CREATE OR REPLACE FUNCTION recalculate_ranking_positions()
RETURNS TRIGGER AS $$
BEGIN
  -- Recalcular posições quando score muda
  UPDATE user_rankings 
  SET position = subquery.new_position
  FROM (
    SELECT 
      id,
      ROW_NUMBER() OVER (PARTITION BY ranking_id ORDER BY score DESC) as new_position
    FROM user_rankings
    WHERE ranking_id = NEW.ranking_id
  ) subquery
  WHERE user_rankings.id = subquery.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para recalcular posições
CREATE TRIGGER recalculate_positions_trigger
  AFTER INSERT OR UPDATE OF score ON user_rankings
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_ranking_positions();

-- Função para atualizar contador de participantes
CREATE OR REPLACE FUNCTION update_participant_count()
RETURNS TRIGGER AS $$
BEGIN
  -- Atualizar contador de participantes no ranking
  UPDATE rankings 
  SET total_participants = (
    SELECT COUNT(*) 
    FROM user_rankings 
    WHERE ranking_id = COALESCE(NEW.ranking_id, OLD.ranking_id)
  )
  WHERE id = COALESCE(NEW.ranking_id, OLD.ranking_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Triggers para contador de participantes
CREATE TRIGGER update_participant_count_insert
  AFTER INSERT ON user_rankings
  FOR EACH ROW
  EXECUTE FUNCTION update_participant_count();

CREATE TRIGGER update_participant_count_delete
  AFTER DELETE ON user_rankings
  FOR EACH ROW
  EXECUTE FUNCTION update_participant_count();

-- COMENTÁRIOS E DOCUMENTAÇÃO
-- =====================================================

COMMENT ON TABLE rankings IS 'Tabela principal de rankings - dados básicos do concurso';
COMMENT ON TABLE user_rankings IS 'Participações dos usuários nos rankings';
COMMENT ON TABLE user_answers IS 'Respostas individuais dos usuários';
COMMENT ON TABLE ranking_answers IS 'Gabarito oficial dos rankings';
COMMENT ON TABLE ranking_disciplines IS 'Disciplinas e pesos dos rankings';

COMMENT ON COLUMN rankings.exam_type IS 'Tipo de exame: Alternativas, Discursiva, Estudo de Caso, Certo ou Errado';
COMMENT ON COLUMN rankings.status IS 'Status do ranking: Ativo, Finalizado, Inativo';
COMMENT ON COLUMN user_rankings.reservation_type IS 'Tipo de reserva: Ampla Concorrência, PCD, PPP, etc.';
COMMENT ON COLUMN user_answers.points_earned IS 'Pontos ganhos nesta questão específica';
COMMENT ON COLUMN ranking_answers.weight IS 'Peso da questão no cálculo da nota';
COMMENT ON COLUMN ranking_disciplines.weight IS 'Peso da disciplina no cálculo da nota final';

-- LOG DE MIGRAÇÃO
-- =====================================================
INSERT INTO migration_logs (migration_name, executed_at, description) 
VALUES (
  '20250115000012_create_normalized_ranking_structure',
  NOW(),
  'Criada estrutura normalizada de rankings otimizada para 5.000 usuários'
) ON CONFLICT DO NOTHING;
