-- Atualizar função calculate_user_score_realtime com regras de mínimo completas
-- Implementação segura com validação e logs

CREATE OR REPLACE FUNCTION public.calculate_user_score_realtime(
  p_ranking_id text,
  p_user_id uuid,
  p_concurso_id uuid,
  p_selected_booklet text
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_user_answers jsonb;
  v_official_answers jsonb;
  v_score numeric := 0;
  v_question_key text;
  v_user_answer text;
  v_correct_answer text;
  v_weight numeric;
  v_is_nullified boolean;
  v_consolidated_data jsonb;
  v_user_ranking_data jsonb;
  v_selected_booklet text;
  v_concurso_data jsonb;
  v_subjects jsonb;
  v_has_cota jsonb;
  
  -- Flags para seções subjetivas
  v_has_discursive boolean := false;
  v_has_case_study_1 boolean := false;
  v_has_case_study_2 boolean := false;
  v_has_case_study_3 boolean := false;
  v_has_other_subjective boolean := false;
  
  -- Mínimos subjetivos
  v_discursive_min_score numeric := 0;
  v_case_study_1_min_score numeric := 0;
  v_case_study_2_min_score numeric := 0;
  v_case_study_3_min_score numeric := 0;
  v_other_subjective_min_score numeric := 0;
  
  -- Scores subjetivos do usuário
  v_discursive_score numeric := 0;
  v_case_study_1_score numeric := 0;
  v_case_study_2_score numeric := 0;
  v_case_study_3_score numeric := 0;
  v_other_subjective_score numeric := 0;
  
  -- Regras de mínimo
  v_has_global_minimum boolean := false;
  v_global_minimum_score numeric := 0;
  v_below_minimum boolean := false;
  v_elimination_reasons text[] := ARRAY[]::text[];
  v_final_status text := 'classificado';
  
  -- Scores por disciplina (para mínimos por bloco)
  v_discipline_scores jsonb := '{}'::jsonb;
  v_discipline_key text;
  v_discipline_score numeric;
  v_discipline_minimum numeric;
  
  -- Scores por cota
  v_quota_type text;
  v_quota_minimum numeric;
  v_quota_below_minimum boolean := false;
  
  -- Logging
  v_calculation_log jsonb;
BEGIN
  -- Log de início
  v_calculation_log := jsonb_build_object(
    'function', 'calculate_user_score_realtime',
    'ranking_id', p_ranking_id,
    'user_id', p_user_id,
    'concurso_id', p_concurso_id,
    'booklet_id', p_selected_booklet,
    'timestamp', NOW(),
    'step', 'start'
  );
  
  -- Get user ranking data (ensure single row)
  SELECT consolidated_data INTO v_consolidated_data
  FROM user_rankings
  WHERE user_id = p_user_id
  LIMIT 1;

  IF v_consolidated_data IS NULL THEN
    RAISE NOTICE 'DEBUG: No user ranking data found for user %', p_user_id;
    RETURN 0;
  END IF;

  -- Find the specific ranking
  v_user_ranking_data := v_consolidated_data->'rankings'->p_ranking_id;
  
  IF v_user_ranking_data IS NULL THEN
    RAISE NOTICE 'DEBUG: No ranking data found for ranking %', p_ranking_id;
    RETURN 0;
  END IF;

  -- Get selected booklet
  v_selected_booklet := COALESCE(v_user_ranking_data->>'selected_booklet_id', p_selected_booklet);
  
  -- Get user answers
  v_user_answers := v_user_ranking_data->'user_data'->'answers';
  
  IF v_user_answers IS NULL THEN
    RAISE NOTICE 'DEBUG: No user answers found';
    RETURN 0;
  END IF;

  -- Get concurso data with official answers and minimum rules
  SELECT 
    official_answers, 
    subjects, 
    has_cota,
    has_minimum_score,
    total_minimum_score
  INTO 
    v_official_answers, 
    v_subjects, 
    v_has_cota,
    v_has_global_minimum,
    v_global_minimum_score
  FROM concursos
  WHERE id = p_concurso_id
  LIMIT 1;

  -- Extract official answers for selected booklet
  v_official_answers := v_official_answers->v_selected_booklet->'questions';
  
  IF v_official_answers IS NULL THEN
    RAISE NOTICE 'DEBUG: No official answers found for booklet %', v_selected_booklet;
    RETURN 0;
  END IF;

  -- Extract subjective section flags and minimum scores from subjects JSONB
  IF v_subjects IS NOT NULL THEN
    v_has_discursive := COALESCE((v_subjects->>'discr')::boolean, false);
    v_has_case_study_1 := COALESCE((v_subjects->>'case1')::boolean, false);
    v_has_case_study_2 := COALESCE((v_subjects->>'case2')::boolean, false);
    v_has_case_study_3 := COALESCE((v_subjects->>'case3')::boolean, false);
    v_has_other_subjective := COALESCE((v_subjects->>'other')::boolean, false);
    
    v_discursive_min_score := COALESCE((v_subjects->>'discr_min_score')::numeric, 0);
    v_case_study_1_min_score := COALESCE((v_subjects->>'case1_min_score')::numeric, 0);
    v_case_study_2_min_score := COALESCE((v_subjects->>'case2_min_score')::numeric, 0);
    v_case_study_3_min_score := COALESCE((v_subjects->>'case3_min_score')::numeric, 0);
    v_other_subjective_min_score := COALESCE((v_subjects->>'other_min_score')::numeric, 0);
  END IF;

  -- Get subjective scores from user data (busca em subjectives)
  v_discursive_score := COALESCE((v_user_ranking_data->'user_data'->'subjectives'->>'discursive')::numeric, 0);
  v_case_study_1_score := COALESCE((v_user_ranking_data->'user_data'->'subjectives'->>'case_study_1')::numeric, 0);
  v_case_study_2_score := COALESCE((v_user_ranking_data->'user_data'->'subjectives'->>'case_study_2')::numeric, 0);
  v_case_study_3_score := COALESCE((v_user_ranking_data->'user_data'->'subjectives'->>'case_study_3')::numeric, 0);
  v_other_subjective_score := COALESCE((v_user_ranking_data->'user_data'->'subjectives'->>'other_subjective')::numeric, 0);

  -- Calculate objective score (estrutura hierárquica)
  FOR v_question_key IN SELECT jsonb_object_keys(v_official_answers)
  LOOP
    v_user_answer := v_user_answers->v_selected_booklet->'default'->>v_question_key;
    v_correct_answer := v_official_answers->v_question_key->>'correct_answer';
    v_weight := COALESCE((v_official_answers->v_question_key->>'weight')::numeric, 1);
    v_is_nullified := COALESCE((v_official_answers->v_question_key->>'is_nullified')::boolean, false);
    
    IF v_user_answer IS NOT NULL AND v_correct_answer IS NOT NULL AND NOT v_is_nullified THEN
      IF v_user_answer = v_correct_answer THEN
        v_score := v_score + v_weight;
      END IF;
    END IF;
  END LOOP;

  -- Add subjective scores
  IF v_has_discursive THEN
    v_score := v_score + v_discursive_score;
  END IF;
  
  IF v_has_case_study_1 THEN
    v_score := v_score + v_case_study_1_score;
  END IF;
  
  IF v_has_case_study_2 THEN
    v_score := v_score + v_case_study_2_score;
  END IF;
  
  IF v_has_case_study_3 THEN
    v_score := v_score + v_case_study_3_score;
  END IF;
  
  IF v_has_other_subjective THEN
    v_score := v_score + v_other_subjective_score;
  END IF;

  -- REGRAS DE MÍNIMO - VERIFICAÇÃO COMPLETA
  
  -- 1. Verificar mínimo global
  IF v_has_global_minimum AND v_score < v_global_minimum_score THEN
    v_below_minimum := true;
    v_elimination_reasons := array_append(v_elimination_reasons, 
      'Mínimo global: ' || v_score || ' < ' || v_global_minimum_score);
  END IF;
  
  -- 2. Verificar mínimos subjetivos
  IF v_has_discursive AND v_discursive_score < v_discursive_min_score THEN
    v_below_minimum := true;
    v_elimination_reasons := array_append(v_elimination_reasons, 
      'Mínimo discursiva: ' || v_discursive_score || ' < ' || v_discursive_min_score);
  END IF;
  
  IF v_has_case_study_1 AND v_case_study_1_score < v_case_study_1_min_score THEN
    v_below_minimum := true;
    v_elimination_reasons := array_append(v_elimination_reasons, 
      'Mínimo caso 1: ' || v_case_study_1_score || ' < ' || v_case_study_1_min_score);
  END IF;
  
  IF v_has_case_study_2 AND v_case_study_2_score < v_case_study_2_min_score THEN
    v_below_minimum := true;
    v_elimination_reasons := array_append(v_elimination_reasons, 
      'Mínimo caso 2: ' || v_case_study_2_score || ' < ' || v_case_study_2_min_score);
  END IF;
  
  IF v_has_case_study_3 AND v_case_study_3_score < v_case_study_3_min_score THEN
    v_below_minimum := true;
    v_elimination_reasons := array_append(v_elimination_reasons, 
      'Mínimo caso 3: ' || v_case_study_3_score || ' < ' || v_case_study_3_min_score);
  END IF;
  
  IF v_has_other_subjective AND v_other_subjective_score < v_other_subjective_min_score THEN
    v_below_minimum := true;
    v_elimination_reasons := array_append(v_elimination_reasons, 
      'Mínimo subjetivo: ' || v_other_subjective_score || ' < ' || v_other_subjective_min_score);
  END IF;
  
  -- 3. Verificar mínimos por disciplina (se existirem na estrutura subjects)
  IF v_subjects IS NOT NULL AND v_subjects ? 'disciplines' THEN
    FOR v_discipline_key IN SELECT jsonb_object_keys(v_subjects->'disciplines')
    LOOP
      v_discipline_score := COALESCE((v_user_ranking_data->'user_data'->'discipline_scores'->>v_discipline_key)::numeric, 0);
      v_discipline_minimum := COALESCE((v_subjects->'disciplines'->v_discipline_key->>'minimum_score')::numeric, 0);
      
      IF v_discipline_minimum > 0 AND v_discipline_score < v_discipline_minimum THEN
        v_below_minimum := true;
        v_elimination_reasons := array_append(v_elimination_reasons, 
          'Mínimo ' || v_discipline_key || ': ' || v_discipline_score || ' < ' || v_discipline_minimum);
      END IF;
    END LOOP;
  END IF;
  
  -- 4. Verificar mínimos por cota
  IF v_has_cota IS NOT NULL THEN
    v_quota_type := v_user_ranking_data->'user_data'->>'reservation_type';
    IF v_quota_type IS NOT NULL AND v_has_cota ? v_quota_type THEN
      v_quota_minimum := COALESCE((v_has_cota->v_quota_type->>'minimum_score')::numeric, 0);
      
      IF v_quota_minimum > 0 AND v_score < v_quota_minimum THEN
        v_below_minimum := true;
        v_elimination_reasons := array_append(v_elimination_reasons, 
          'Mínimo cota ' || v_quota_type || ': ' || v_score || ' < ' || v_quota_minimum);
      END IF;
    END IF;
  END IF;
  
  -- Definir status final
  IF v_below_minimum THEN
    v_final_status := 'E'; -- Eliminado
  ELSE
    v_final_status := 'classificado';
  END IF;

  -- Update user ranking with new score, below_minimum flag, status and elimination reasons
  UPDATE user_rankings
  SET consolidated_data = jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          consolidated_data,
          ARRAY['rankings', p_ranking_id, 'user_data', 'score'],
          to_jsonb(v_score)
        ),
        ARRAY['rankings', p_ranking_id, 'user_data', 'below_minimum'],
        to_jsonb(v_below_minimum)
      ),
      ARRAY['rankings', p_ranking_id, 'user_data', 'status'],
      to_jsonb(v_final_status)
    ),
    ARRAY['rankings', p_ranking_id, 'user_data', 'elimination_reasons'],
    to_jsonb(v_elimination_reasons)
  )
  WHERE user_id = p_user_id;

  -- Log da execução
  v_calculation_log := jsonb_set(
    jsonb_set(
      v_calculation_log,
      ARRAY['step'],
      to_jsonb('completed')
    ),
    ARRAY['result'],
    jsonb_build_object(
      'score', v_score,
      'below_minimum', v_below_minimum,
      'status', v_final_status,
      'elimination_reasons', v_elimination_reasons,
      'global_minimum', v_global_minimum_score,
      'has_global_minimum', v_has_global_minimum
    )
  );
  
  -- Inserir log de cálculo
  INSERT INTO score_calculation_logs (user_ranking_id, calculation_type, calculation_details)
  VALUES (p_user_id::text, 'calculate_user_score_realtime', v_calculation_log);

  RETURN v_score;
END;
$function$;

-- Comentário da função atualizada
COMMENT ON FUNCTION calculate_user_score_realtime IS 'Função atualizada com regras completas de mínimo: global, subjetivo, por disciplina e por cota. Usuários eliminados ficam com status "E" e notas em vermelho.';




