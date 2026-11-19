-- Adicionar campos necessários para funcionamento acumulativo das sessões
ALTER TABLE study_sessions ADD COLUMN IF NOT EXISTS session_link TEXT;
ALTER TABLE study_sessions ADD COLUMN IF NOT EXISTS total_duration_minutes INTEGER DEFAULT 0;
ALTER TABLE study_sessions ADD COLUMN IF NOT EXISTS total_questions INTEGER DEFAULT 0;
ALTER TABLE study_sessions ADD COLUMN IF NOT EXISTS total_correct_answers INTEGER DEFAULT 0;
ALTER TABLE study_sessions ADD COLUMN IF NOT EXISTS session_count INTEGER DEFAULT 0;
ALTER TABLE study_sessions ADD COLUMN IF NOT EXISTS last_session_date DATE;

-- Adicionar referência à sessão do cronograma
ALTER TABLE study_sessions ADD COLUMN IF NOT EXISTS schedule_session_id UUID REFERENCES study_schedule(id);

-- Adicionar índice para melhor performance
CREATE INDEX IF NOT EXISTS idx_study_sessions_schedule_session ON study_sessions(schedule_session_id);

-- Atualizar sessões existentes para ter valores padrão corretos
UPDATE study_sessions 
SET 
  total_duration_minutes = COALESCE(duration_minutes, 0),
  total_questions = 0,
  total_correct_answers = 0,
  session_count = 1,
  last_session_date = session_date
WHERE total_duration_minutes IS NULL;