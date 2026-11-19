-- Tabela para metas de estudo
CREATE TABLE IF NOT EXISTS study_goals_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  goal_type TEXT NOT NULL CHECK (goal_type IN ('daily', 'weekly')),
  target_hours NUMERIC NOT NULL DEFAULT 2,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_activity_date DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela para repetição espaçada
CREATE TABLE IF NOT EXISTS spaced_repetition_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  subject_name TEXT NOT NULL,
  block_name TEXT,
  difficulty_level INTEGER DEFAULT 1 CHECK (difficulty_level BETWEEN 1 AND 5),
  next_review_date DATE NOT NULL,
  review_count INTEGER DEFAULT 0,
  last_reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela para templates de cronograma
CREATE TABLE IF NOT EXISTS schedule_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  organization TEXT NOT NULL,
  template_type TEXT NOT NULL CHECK (template_type IN ('contest', 'bank')),
  schedule_data JSONB NOT NULL DEFAULT '[]',
  is_public BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- RLS policies para study_goals_tracking
ALTER TABLE study_goals_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem ver suas próprias metas de tracking"
ON study_goals_tracking FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem inserir suas próprias metas de tracking"
ON study_goals_tracking FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar suas próprias metas de tracking"
ON study_goals_tracking FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem deletar suas próprias metas de tracking"
ON study_goals_tracking FOR DELETE
USING (auth.uid() = user_id);

-- RLS policies para spaced_repetition_queue
ALTER TABLE spaced_repetition_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem ver sua própria fila de repetição"
ON spaced_repetition_queue FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem inserir em sua própria fila de repetição"
ON spaced_repetition_queue FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar sua própria fila de repetição"
ON spaced_repetition_queue FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem deletar de sua própria fila de repetição"
ON spaced_repetition_queue FOR DELETE
USING (auth.uid() = user_id);

-- RLS policies para schedule_templates
ALTER TABLE schedule_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos podem ver templates públicos"
ON schedule_templates FOR SELECT
USING (is_public = true OR auth.uid() = created_by);

CREATE POLICY "Usuários autenticados podem criar templates"
ON schedule_templates FOR INSERT
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Criadores podem atualizar seus templates"
ON schedule_templates FOR UPDATE
USING (auth.uid() = created_by);

CREATE POLICY "Criadores podem deletar seus templates"
ON schedule_templates FOR DELETE
USING (auth.uid() = created_by);

-- Inserir alguns templates iniciais
INSERT INTO schedule_templates (name, organization, template_type, schedule_data, created_by) VALUES
('Cronograma Cebraspe Padrão', 'Cebraspe', 'bank', '[
  {"day": 1, "subjects": ["Português", "Raciocínio Lógico"], "hours": 4},
  {"day": 2, "subjects": ["Direito Constitucional", "Direito Administrativo"], "hours": 4},
  {"day": 3, "subjects": ["Informática", "Atualidades"], "hours": 3},
  {"day": 4, "subjects": ["Conhecimentos Específicos"], "hours": 5},
  {"day": 5, "subjects": ["Revisão Geral"], "hours": 3},
  {"day": 6, "subjects": ["Simulados"], "hours": 4},
  {"day": 0, "subjects": ["Descanso/Revisão Leve"], "hours": 2}
]', NULL),
('Cronograma FCC Intensivo', 'FCC', 'bank', '[
  {"day": 1, "subjects": ["Português", "Matemática"], "hours": 4},
  {"day": 2, "subjects": ["Direito Constitucional"], "hours": 4},
  {"day": 3, "subjects": ["Direito Administrativo"], "hours": 4},
  {"day": 4, "subjects": ["Conhecimentos Específicos"], "hours": 6},
  {"day": 5, "subjects": ["Informática", "Atualidades"], "hours": 3},
  {"day": 6, "subjects": ["Simulados e Revisão"], "hours": 5},
  {"day": 0, "subjects": ["Descanso"], "hours": 1}
]', NULL);