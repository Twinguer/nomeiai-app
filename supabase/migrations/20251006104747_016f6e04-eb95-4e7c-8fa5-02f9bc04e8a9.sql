-- Fase 1: Criar nova tabela study_cycles_v2 com estrutura otimizada
CREATE TABLE IF NOT EXISTS public.study_cycles_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cycle_name TEXT NOT NULL,
  exam_date DATE NOT NULL,
  organ TEXT,
  position TEXT,
  edital_link TEXT,
  curso_link TEXT,
  video_link TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  schedule_data JSONB NOT NULL DEFAULT '{
    "weekly_schedule": [],
    "metadata": {
      "total_sessions": 0,
      "total_hours": 0
    }
  }'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para otimizar consultas
CREATE INDEX idx_study_cycles_v2_user_id ON public.study_cycles_v2(user_id);
CREATE INDEX idx_study_cycles_v2_is_active ON public.study_cycles_v2(is_active);
CREATE INDEX idx_study_cycles_v2_schedule_data ON public.study_cycles_v2 USING GIN(schedule_data);

-- Constraint: máximo 2 ciclos ativos por usuário
CREATE OR REPLACE FUNCTION check_active_cycles_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_active = true THEN
    IF (SELECT COUNT(*) FROM public.study_cycles_v2 
        WHERE user_id = NEW.user_id 
        AND is_active = true 
        AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)) >= 2 THEN
      RAISE EXCEPTION 'Usuário já possui 2 ciclos ativos. Desative um ciclo antes de criar outro.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_active_cycles_limit
  BEFORE INSERT OR UPDATE ON public.study_cycles_v2
  FOR EACH ROW
  EXECUTE FUNCTION check_active_cycles_limit();

-- Trigger para atualizar updated_at
CREATE TRIGGER update_study_cycles_v2_updated_at
  BEFORE UPDATE ON public.study_cycles_v2
  FOR EACH ROW
  EXECUTE FUNCTION public.update_study_cycles_updated_at();

-- RLS Policies
ALTER TABLE public.study_cycles_v2 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem ver seus próprios ciclos v2"
  ON public.study_cycles_v2
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem inserir seus próprios ciclos v2"
  ON public.study_cycles_v2
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar seus próprios ciclos v2"
  ON public.study_cycles_v2
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem deletar seus próprios ciclos v2"
  ON public.study_cycles_v2
  FOR DELETE
  USING (auth.uid() = user_id);

-- Função helper para adicionar sessão ao cronograma
CREATE OR REPLACE FUNCTION add_schedule_session(
  p_cycle_id UUID,
  p_day_of_week INTEGER,
  p_session_data JSONB
)
RETURNS JSONB AS $$
DECLARE
  v_schedule JSONB;
  v_day_schedule JSONB;
  v_sessions JSONB;
BEGIN
  -- Buscar schedule atual
  SELECT schedule_data INTO v_schedule
  FROM study_cycles_v2
  WHERE id = p_cycle_id AND user_id = auth.uid();

  IF v_schedule IS NULL THEN
    RAISE EXCEPTION 'Ciclo não encontrado';
  END IF;

  -- Buscar ou criar dia da semana
  v_day_schedule := v_schedule->'weekly_schedule'->p_day_of_week;
  
  IF v_day_schedule IS NULL THEN
    v_day_schedule := jsonb_build_object(
      'day', p_day_of_week,
      'sessions', '[]'::jsonb
    );
  END IF;

  -- Adicionar sessão
  v_sessions := COALESCE(v_day_schedule->'sessions', '[]'::jsonb);
  v_sessions := v_sessions || p_session_data;
  
  v_day_schedule := jsonb_set(v_day_schedule, '{sessions}', v_sessions);

  -- Atualizar weekly_schedule
  v_schedule := jsonb_set(
    v_schedule,
    array['weekly_schedule', p_day_of_week::text],
    v_day_schedule
  );

  -- Atualizar metadata
  v_schedule := jsonb_set(
    v_schedule,
    '{metadata,total_sessions}',
    to_jsonb((v_schedule->'metadata'->>'total_sessions')::int + 1)
  );

  -- Salvar no banco
  UPDATE study_cycles_v2
  SET schedule_data = v_schedule,
      updated_at = now()
  WHERE id = p_cycle_id;

  RETURN v_schedule;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Função helper para registrar sessão completada
CREATE OR REPLACE FUNCTION record_completed_session(
  p_cycle_id UUID,
  p_day_of_week INTEGER,
  p_session_id UUID,
  p_session_details JSONB
)
RETURNS JSONB AS $$
DECLARE
  v_schedule JSONB;
  v_sessions JSONB;
  v_session JSONB;
  v_session_index INT;
  v_completed_sessions JSONB;
  v_total_stats JSONB;
BEGIN
  -- Buscar schedule atual
  SELECT schedule_data INTO v_schedule
  FROM study_cycles_v2
  WHERE id = p_cycle_id AND user_id = auth.uid();

  IF v_schedule IS NULL THEN
    RAISE EXCEPTION 'Ciclo não encontrado';
  END IF;

  -- Buscar sessões do dia
  v_sessions := v_schedule->'weekly_schedule'->p_day_of_week->'sessions';
  
  -- Encontrar a sessão
  FOR v_session_index IN 0..jsonb_array_length(v_sessions)-1 LOOP
    v_session := v_sessions->v_session_index;
    
    IF (v_session->>'id')::uuid = p_session_id THEN
      -- Adicionar aos completed_sessions
      v_completed_sessions := COALESCE(v_session->'completed_sessions', '[]'::jsonb);
      v_completed_sessions := v_completed_sessions || p_session_details;
      
      v_session := jsonb_set(v_session, '{completed_sessions}', v_completed_sessions);
      
      -- Atualizar total_stats
      v_total_stats := COALESCE(v_session->'total_stats', jsonb_build_object(
        'total_duration_minutes', 0,
        'total_questions', 0,
        'total_correct', 0,
        'session_count', 0
      ));
      
      v_total_stats := jsonb_build_object(
        'total_duration_minutes', 
        (v_total_stats->>'total_duration_minutes')::int + (p_session_details->>'duration_minutes')::int,
        'total_questions',
        (v_total_stats->>'total_questions')::int + (p_session_details->>'questions')::int,
        'total_correct',
        (v_total_stats->>'total_correct')::int + (p_session_details->>'correct_answers')::int,
        'session_count',
        (v_total_stats->>'session_count')::int + 1,
        'last_session_date',
        p_session_details->>'date'
      );
      
      v_session := jsonb_set(v_session, '{total_stats}', v_total_stats);
      
      -- Atualizar no array
      v_sessions := jsonb_set(v_sessions, array[v_session_index::text], v_session);
      
      EXIT;
    END IF;
  END LOOP;
  
  -- Atualizar schedule
  v_schedule := jsonb_set(
    v_schedule,
    array['weekly_schedule', p_day_of_week::text, 'sessions'],
    v_sessions
  );
  
  -- Salvar no banco
  UPDATE study_cycles_v2
  SET schedule_data = v_schedule,
      updated_at = now()
  WHERE id = p_cycle_id;

  RETURN v_schedule;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;