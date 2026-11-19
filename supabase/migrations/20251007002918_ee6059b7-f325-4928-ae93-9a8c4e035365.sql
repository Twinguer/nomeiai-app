-- Corrigir search_path das novas funções (corrigindo ordem de drop)

-- Dropar trigger primeiro
DROP TRIGGER IF EXISTS enforce_active_cycles_limit ON public.study_cycles_v2;

-- Agora dropar e recriar as funções com search_path correto
DROP FUNCTION IF EXISTS check_active_cycles_limit();
CREATE OR REPLACE FUNCTION check_active_cycles_limit()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

-- Recriar o trigger
CREATE TRIGGER enforce_active_cycles_limit
  BEFORE INSERT OR UPDATE ON public.study_cycles_v2
  FOR EACH ROW
  EXECUTE FUNCTION check_active_cycles_limit();

-- Recriar add_schedule_session com search_path
DROP FUNCTION IF EXISTS add_schedule_session(UUID, INTEGER, JSONB);
CREATE OR REPLACE FUNCTION add_schedule_session(
  p_cycle_id UUID,
  p_day_of_week INTEGER,
  p_session_data JSONB
)
RETURNS JSONB 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_schedule JSONB;
  v_day_schedule JSONB;
  v_sessions JSONB;
BEGIN
  SELECT schedule_data INTO v_schedule
  FROM study_cycles_v2
  WHERE id = p_cycle_id AND user_id = auth.uid();

  IF v_schedule IS NULL THEN
    RAISE EXCEPTION 'Ciclo não encontrado';
  END IF;

  v_day_schedule := v_schedule->'weekly_schedule'->p_day_of_week;
  
  IF v_day_schedule IS NULL THEN
    v_day_schedule := jsonb_build_object(
      'day', p_day_of_week,
      'sessions', '[]'::jsonb
    );
  END IF;

  v_sessions := COALESCE(v_day_schedule->'sessions', '[]'::jsonb);
  v_sessions := v_sessions || p_session_data;
  
  v_day_schedule := jsonb_set(v_day_schedule, '{sessions}', v_sessions);

  v_schedule := jsonb_set(
    v_schedule,
    array['weekly_schedule', p_day_of_week::text],
    v_day_schedule
  );

  v_schedule := jsonb_set(
    v_schedule,
    '{metadata,total_sessions}',
    to_jsonb((v_schedule->'metadata'->>'total_sessions')::int + 1)
  );

  UPDATE study_cycles_v2
  SET schedule_data = v_schedule,
      updated_at = now()
  WHERE id = p_cycle_id;

  RETURN v_schedule;
END;
$$;

-- Recriar record_completed_session com search_path
DROP FUNCTION IF EXISTS record_completed_session(UUID, INTEGER, UUID, JSONB);
CREATE OR REPLACE FUNCTION record_completed_session(
  p_cycle_id UUID,
  p_day_of_week INTEGER,
  p_session_id UUID,
  p_session_details JSONB
)
RETURNS JSONB 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_schedule JSONB;
  v_sessions JSONB;
  v_session JSONB;
  v_session_index INT;
  v_completed_sessions JSONB;
  v_total_stats JSONB;
BEGIN
  SELECT schedule_data INTO v_schedule
  FROM study_cycles_v2
  WHERE id = p_cycle_id AND user_id = auth.uid();

  IF v_schedule IS NULL THEN
    RAISE EXCEPTION 'Ciclo não encontrado';
  END IF;

  v_sessions := v_schedule->'weekly_schedule'->p_day_of_week->'sessions';
  
  FOR v_session_index IN 0..jsonb_array_length(v_sessions)-1 LOOP
    v_session := v_sessions->v_session_index;
    
    IF (v_session->>'id')::uuid = p_session_id THEN
      v_completed_sessions := COALESCE(v_session->'completed_sessions', '[]'::jsonb);
      v_completed_sessions := v_completed_sessions || p_session_details;
      
      v_session := jsonb_set(v_session, '{completed_sessions}', v_completed_sessions);
      
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
      
      v_sessions := jsonb_set(v_sessions, array[v_session_index::text], v_session);
      
      EXIT;
    END IF;
  END LOOP;
  
  v_schedule := jsonb_set(
    v_schedule,
    array['weekly_schedule', p_day_of_week::text, 'sessions'],
    v_sessions
  );
  
  UPDATE study_cycles_v2
  SET schedule_data = v_schedule,
      updated_at = now()
  WHERE id = p_cycle_id;

  RETURN v_schedule;
END;
$$;