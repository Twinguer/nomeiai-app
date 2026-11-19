-- Fix functions to use new JSONB structure from concursos table
-- This migration updates all functions to use concursos.official_answers instead of official_answer_weights

-- Update calculate_user_score_realtime function
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
  v_has_discursive boolean := false;
  v_has_case_study_1 boolean := false;
  v_has_case_study_2 boolean := false;
  v_has_case_study_3 boolean := false;
  v_has_other_subjective boolean := false;
  v_discursive_min_score numeric := 0;
  v_case_study_1_min_score numeric := 0;
  v_case_study_2_min_score numeric := 0;
  v_case_study_3_min_score numeric := 0;
  v_other_subjective_min_score numeric := 0;
  v_discursive_score numeric := 0;
  v_case_study_1_score numeric := 0;
  v_case_study_2_score numeric := 0;
  v_case_study_3_score numeric := 0;
  v_other_subjective_score numeric := 0;
  v_below_minimum boolean := false;
BEGIN
  -- Get user ranking data
  SELECT consolidated_data INTO v_consolidated_data
  FROM user_rankings
  WHERE user_id = p_user_id;

  IF v_consolidated_data IS NULL THEN
    RETURN 0;
  END IF;

  -- Find the specific ranking
  v_user_ranking_data := v_consolidated_data->'rankings'->p_ranking_id;
  
  IF v_user_ranking_data IS NULL THEN
    RETURN 0;
  END IF;

  -- Get selected booklet
  v_selected_booklet := COALESCE(v_user_ranking_data->>'selected_booklet_id', p_selected_booklet);
  
  -- Get user answers
  v_user_answers := v_user_ranking_data->'user_data'->'answers';
  
  IF v_user_answers IS NULL THEN
    RETURN 0;
  END IF;

  -- Get concurso data with official answers
  SELECT official_answers, subjects INTO v_official_answers, v_subjects
  FROM concursos
  WHERE id = p_concurso_id;

  -- Extract official answers for selected booklet
  v_official_answers := v_official_answers->v_selected_booklet->'questions';
  
  IF v_official_answers IS NULL THEN
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

  -- Get subjective scores from user data
  v_discursive_score := COALESCE((v_user_ranking_data->'user_data'->'subjective_scores'->>'discursive_score')::numeric, 0);
  v_case_study_1_score := COALESCE((v_user_ranking_data->'user_data'->'subjective_scores'->>'case_study_1_score')::numeric, 0);
  v_case_study_2_score := COALESCE((v_user_ranking_data->'user_data'->'subjective_scores'->>'case_study_2_score')::numeric, 0);
  v_case_study_3_score := COALESCE((v_user_ranking_data->'user_data'->'subjective_scores'->>'case_study_3_score')::numeric, 0);
  v_other_subjective_score := COALESCE((v_user_ranking_data->'user_data'->'subjective_scores'->>'other_subjective_score')::numeric, 0);

  -- Calculate objective score
  FOR v_question_key IN SELECT jsonb_object_keys(v_official_answers)
  LOOP
    v_user_answer := v_user_answers->>v_question_key;
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

  -- Check if below minimum score
  v_below_minimum := false;
  IF v_has_discursive AND v_discursive_score < v_discursive_min_score THEN
    v_below_minimum := true;
  ELSIF v_has_case_study_1 AND v_case_study_1_score < v_case_study_1_min_score THEN
    v_below_minimum := true;
  ELSIF v_has_case_study_2 AND v_case_study_2_score < v_case_study_2_min_score THEN
    v_below_minimum := true;
  ELSIF v_has_case_study_3 AND v_case_study_3_score < v_case_study_3_min_score THEN
    v_below_minimum := true;
  ELSIF v_has_other_subjective AND v_other_subjective_score < v_other_subjective_min_score THEN
    v_below_minimum := true;
  END IF;

  -- Update user ranking with new score and below_minimum flag
  UPDATE user_rankings
  SET consolidated_data = jsonb_set(
    jsonb_set(
      consolidated_data,
      ARRAY['rankings', p_ranking_id, 'user_data', 'score'],
      to_jsonb(v_score)
    ),
    ARRAY['rankings', p_ranking_id, 'user_data', 'below_minimum'],
    to_jsonb(v_below_minimum)
  )
  WHERE user_id = p_user_id;

  RETURN v_score;
END;
$function$;

-- Update recalculate_all_scores_with_weights function
CREATE OR REPLACE FUNCTION public.recalculate_all_scores_with_weights(
  p_concurso_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_user_ranking_record record;
  v_ranking_key text;
  v_updated_count integer := 0;
  v_start_time timestamp;
  v_end_time timestamp;
  v_execution_time integer;
  v_official_answers jsonb;
  v_concurso_exists boolean := false;
BEGIN
  v_start_time := clock_timestamp();
  
  -- Check if concurso exists and has official answers
  SELECT EXISTS(
    SELECT 1 FROM concursos 
    WHERE id = p_concurso_id 
    AND official_answers IS NOT NULL
  ) INTO v_concurso_exists;
  
  IF NOT v_concurso_exists THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Concurso not found or no official answers available',
      'updatedCount', 0,
      'executionTimeMs', 0
    );
  END IF;

  -- Get official answers structure for logging
  SELECT official_answers INTO v_official_answers
  FROM concursos
  WHERE id = p_concurso_id;

  -- Log the operation
  INSERT INTO score_calculation_logs (user_ranking_id, calculation_type, calculation_details)
  VALUES (
    'system_recalc_' || p_concurso_id::text,
    'batch_recalculation_start',
    jsonb_build_object(
      'concurso_id', p_concurso_id,
      'available_booklets', (
        SELECT array_agg(key) 
        FROM jsonb_object_keys(v_official_answers) AS key
      ),
      'timestamp', now()
    )
  );

  -- Process all user rankings for this concurso
  FOR v_user_ranking_record IN
    SELECT user_id, consolidated_data
    FROM user_rankings
    WHERE consolidated_data IS NOT NULL
  LOOP
    -- Check if this user has rankings for the target concurso
    FOR v_ranking_key IN
      SELECT key
      FROM jsonb_object_keys(v_user_ranking_record.consolidated_data->'rankings') AS key
    LOOP
      IF (v_user_ranking_record.consolidated_data->'rankings'->v_ranking_key->>'concurso_id')::uuid = p_concurso_id THEN
        -- Recalculate score for this ranking
        PERFORM calculate_user_score_realtime(
          v_ranking_key,
          v_user_ranking_record.user_id,
          p_concurso_id,
          v_user_ranking_record.consolidated_data->'rankings'->v_ranking_key->>'selected_booklet_id'
        );
        
        v_updated_count := v_updated_count + 1;
      END IF;
    END LOOP;
  END LOOP;

  v_end_time := clock_timestamp();
  v_execution_time := EXTRACT(EPOCH FROM (v_end_time - v_start_time)) * 1000;

  -- Log completion
  INSERT INTO score_calculation_logs (user_ranking_id, calculation_type, calculation_details)
  VALUES (
    'system_recalc_' || p_concurso_id::text,
    'batch_recalculation_complete',
    jsonb_build_object(
      'concurso_id', p_concurso_id,
      'updated_count', v_updated_count,
      'execution_time_ms', v_execution_time,
      'timestamp', now()
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'updatedCount', v_updated_count,
    'executionTimeMs', v_execution_time
  );
END;
$function$;

-- Update save_user_answers_and_calculate_scores function
CREATE OR REPLACE FUNCTION public.save_user_answers_and_calculate_scores(
  p_ranking_id text,
  p_user_id uuid,
  p_concurso_id uuid,
  p_answers jsonb,
  p_selected_booklet text,
  p_subjective_scores jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_consolidated_data jsonb;
  v_ranking_data jsonb;
  v_updated_data jsonb;
  v_score numeric;
  v_below_minimum boolean := false;
  v_subjects jsonb;
  v_has_discursive boolean := false;
  v_has_case_study_1 boolean := false;
  v_has_case_study_2 boolean := false;
  v_has_case_study_3 boolean := false;
  v_has_other_subjective boolean := false;
  v_discursive_min_score numeric := 0;
  v_case_study_1_min_score numeric := 0;
  v_case_study_2_min_score numeric := 0;
  v_case_study_3_min_score numeric := 0;
  v_other_subjective_min_score numeric := 0;
  v_discursive_score numeric := 0;
  v_case_study_1_score numeric := 0;
  v_case_study_2_score numeric := 0;
  v_case_study_3_score numeric := 0;
  v_other_subjective_score numeric := 0;
BEGIN
  -- Get current consolidated data
  SELECT consolidated_data INTO v_consolidated_data
  FROM user_rankings
  WHERE user_id = p_user_id;

  IF v_consolidated_data IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'User ranking not found');
  END IF;

  -- Get the specific ranking data
  v_ranking_data := v_consolidated_data->'rankings'->p_ranking_id;
  
  IF v_ranking_data IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Ranking not found');
  END IF;

  -- Get subjective section configuration from concurso
  SELECT subjects INTO v_subjects
  FROM concursos
  WHERE id = p_concurso_id;

  -- Extract subjective section flags and minimum scores
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

  -- Extract subjective scores from input
  IF p_subjective_scores IS NOT NULL THEN
    v_discursive_score := COALESCE((p_subjective_scores->>'discursive_score')::numeric, 0);
    v_case_study_1_score := COALESCE((p_subjective_scores->>'case_study_1_score')::numeric, 0);
    v_case_study_2_score := COALESCE((p_subjective_scores->>'case_study_2_score')::numeric, 0);
    v_case_study_3_score := COALESCE((p_subjective_scores->>'case_study_3_score')::numeric, 0);
    v_other_subjective_score := COALESCE((p_subjective_scores->>'other_subjective_score')::numeric, 0);
  END IF;

  -- Check if below minimum score
  v_below_minimum := false;
  IF v_has_discursive AND v_discursive_score < v_discursive_min_score THEN
    v_below_minimum := true;
  ELSIF v_has_case_study_1 AND v_case_study_1_score < v_case_study_1_min_score THEN
    v_below_minimum := true;
  ELSIF v_has_case_study_2 AND v_case_study_2_score < v_case_study_2_min_score THEN
    v_below_minimum := true;
  ELSIF v_has_case_study_3 AND v_case_study_3_score < v_case_study_3_min_score THEN
    v_below_minimum := true;
  ELSIF v_has_other_subjective AND v_other_subjective_score < v_other_subjective_min_score THEN
    v_below_minimum := true;
  END IF;

  -- Update the ranking data
  v_updated_data := jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          v_ranking_data,
          ARRAY['user_data', 'answers'],
          p_answers
        ),
        ARRAY['user_data', 'subjective_scores'],
        COALESCE(p_subjective_scores, '{}'::jsonb)
      ),
      ARRAY['user_data', 'score'],
      to_jsonb(v_score)
    ),
    ARRAY['user_data', 'below_minimum'],
    to_jsonb(v_below_minimum)
  );

  -- Update consolidated data
  v_consolidated_data := jsonb_set(
    v_consolidated_data,
    ARRAY['rankings', p_ranking_id],
    v_updated_data
  );

  -- Save to database
  UPDATE user_rankings
  SET consolidated_data = v_consolidated_data
  WHERE user_id = p_user_id;

  -- Calculate final score
  v_score := calculate_user_score_realtime(
    p_ranking_id,
    p_user_id,
    p_concurso_id,
    p_selected_booklet
  );

  RETURN jsonb_build_object(
    'success', true,
    'score', v_score,
    'below_minimum', v_below_minimum
  );
END;
$function$;












