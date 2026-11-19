-- Criar tabelas para o módulo de estudos

-- Tabela de planos de estudo
CREATE TABLE public.study_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE,
  daily_goal_hours NUMERIC DEFAULT 4,
  weekly_goal_hours NUMERIC DEFAULT 30,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de matérias de estudo
CREATE TABLE public.study_subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#3b82f6',
  priority INTEGER DEFAULT 1, -- 1=alta, 2=média, 3=baixa
  weekly_hours NUMERIC DEFAULT 5,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de sessões de estudo
CREATE TABLE public.study_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  study_plan_id UUID REFERENCES study_plans(id) ON DELETE SET NULL,
  subject_id UUID REFERENCES study_subjects(id) ON DELETE SET NULL,
  session_date DATE NOT NULL DEFAULT CURRENT_DATE,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE,
  duration_minutes INTEGER DEFAULT 0,
  notes TEXT,
  study_type TEXT DEFAULT 'reading', -- reading, practice, review, simulation
  quality_rating INTEGER CHECK (quality_rating >= 1 AND quality_rating <= 5),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de metas de estudo
CREATE TABLE public.study_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_type TEXT NOT NULL, -- daily, weekly, monthly, custom
  target_value NUMERIC NOT NULL,
  current_value NUMERIC DEFAULT 0,
  unit_type TEXT NOT NULL, -- hours, sessions, topics
  target_date DATE,
  description TEXT,
  is_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de cronograma de estudos
CREATE TABLE public.study_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  study_plan_id UUID REFERENCES study_plans(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES study_subjects(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=domingo, 6=sábado
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de progresso de estudos
CREATE TABLE public.study_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES study_subjects(id) ON DELETE CASCADE,
  progress_date DATE NOT NULL DEFAULT CURRENT_DATE,
  hours_studied NUMERIC DEFAULT 0,
  topics_completed INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, subject_id, progress_date)
);

-- Tabela de lembretes de estudo
CREATE TABLE public.study_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  reminder_date DATE NOT NULL,
  reminder_time TIME NOT NULL,
  is_sent BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.study_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_reminders ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para study_plans
CREATE POLICY "Usuários podem ver seus próprios planos" ON study_plans
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem inserir seus próprios planos" ON study_plans
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar seus próprios planos" ON study_plans
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem deletar seus próprios planos" ON study_plans
  FOR DELETE USING (auth.uid() = user_id);

-- Políticas RLS para study_subjects
CREATE POLICY "Usuários podem ver suas próprias matérias" ON study_subjects
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem inserir suas próprias matérias" ON study_subjects
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar suas próprias matérias" ON study_subjects
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem deletar suas próprias matérias" ON study_subjects
  FOR DELETE USING (auth.uid() = user_id);

-- Políticas RLS para study_sessions
CREATE POLICY "Usuários podem ver suas próprias sessões" ON study_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem inserir suas próprias sessões" ON study_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar suas próprias sessões" ON study_sessions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem deletar suas próprias sessões" ON study_sessions
  FOR DELETE USING (auth.uid() = user_id);

-- Políticas RLS para study_goals
CREATE POLICY "Usuários podem ver suas próprias metas" ON study_goals
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem inserir suas próprias metas" ON study_goals
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar suas próprias metas" ON study_goals
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem deletar suas próprias metas" ON study_goals
  FOR DELETE USING (auth.uid() = user_id);

-- Políticas RLS para study_schedule
CREATE POLICY "Usuários podem ver seus próprios cronogramas" ON study_schedule
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem inserir seus próprios cronogramas" ON study_schedule
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar seus próprios cronogramas" ON study_schedule
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem deletar seus próprios cronogramas" ON study_schedule
  FOR DELETE USING (auth.uid() = user_id);

-- Políticas RLS para study_progress
CREATE POLICY "Usuários podem ver seu próprio progresso" ON study_progress
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem inserir seu próprio progresso" ON study_progress
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar seu próprio progresso" ON study_progress
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem deletar seu próprio progresso" ON study_progress
  FOR DELETE USING (auth.uid() = user_id);

-- Políticas RLS para study_reminders
CREATE POLICY "Usuários podem ver seus próprios lembretes" ON study_reminders
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem inserir seus próprios lembretes" ON study_reminders
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar seus próprios lembretes" ON study_reminders
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem deletar seus próprios lembretes" ON study_reminders
  FOR DELETE USING (auth.uid() = user_id);

-- Criar índices para melhor performance
CREATE INDEX idx_study_plans_user_id ON study_plans(user_id);
CREATE INDEX idx_study_subjects_user_id ON study_subjects(user_id);
CREATE INDEX idx_study_sessions_user_id ON study_sessions(user_id);
CREATE INDEX idx_study_sessions_date ON study_sessions(session_date);
CREATE INDEX idx_study_goals_user_id ON study_goals(user_id);
CREATE INDEX idx_study_schedule_user_id ON study_schedule(user_id);
CREATE INDEX idx_study_progress_user_id ON study_progress(user_id);
CREATE INDEX idx_study_progress_date ON study_progress(progress_date);
CREATE INDEX idx_study_reminders_user_id ON study_reminders(user_id);

-- Função para atualizar timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para atualizar updated_at automaticamente
CREATE TRIGGER update_study_plans_updated_at 
    BEFORE UPDATE ON study_plans 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_study_subjects_updated_at 
    BEFORE UPDATE ON study_subjects 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_study_sessions_updated_at 
    BEFORE UPDATE ON study_sessions 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_study_goals_updated_at 
    BEFORE UPDATE ON study_goals 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_study_schedule_updated_at 
    BEFORE UPDATE ON study_schedule 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_study_progress_updated_at 
    BEFORE UPDATE ON study_progress 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_study_reminders_updated_at 
    BEFORE UPDATE ON study_reminders 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();