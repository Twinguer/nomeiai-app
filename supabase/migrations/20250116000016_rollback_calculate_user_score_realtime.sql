-- ROLLBACK: Restaurar função calculate_user_score_realtime original
-- Use este arquivo se a implementação de regras de mínimo causar problemas

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
  -- Get user ranking data (ensure single row)
  SELECT consolidated_data INTO v_consolidated_data
  FROM user_rankings
  WHERE user_id = p_user_id
  LIMIT 1;

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

  -- Get concurso data with official answers (ensure single row)
  SELECT official_answers, subjects INTO v_official_answers, v_subjects
  FROM concursos
  WHERE id = p_concurso_id
  LIMIT 1;

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

  -- Get subjective scores from user data (VERSÃO ORIGINAL - busca em subjective_scores)
  v_discursive_score := COALESCE((v_user_ranking_data->'user_data'->'subjective_scores'->>'discursive_score')::numeric, 0);
  v_case_study_1_score := COALESCE((v_user_ranking_data->'user_data'->'subjective_scores'->>'case_study_1_score')::numeric, 0);
  v_case_study_2_score := COALESCE((v_user_ranking_data->'user_data'->'subjective_scores'->>'case_study_2_score')::numeric, 0);
  v_case_study_3_score := COALESCE((v_user_ranking_data->'user_data'->'subjective_scores'->>'case_study_3_score')::numeric, 0);
  v_other_subjective_score := COALESCE((v_user_ranking_data->'user_data'->'subjective_scores'->>'other_subjective_score')::numeric, 0);

  -- Calculate objective score (VERSÃO ORIGINAL - estrutura plana)
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

  -- Check if below minimum score (VERSÃO ORIGINAL - apenas mínimos subjetivos)
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

-- Comentário para identificar que é rollback
COMMENT ON FUNCTION calculate_user_score_realtime IS 'ROLLBACK: Função restaurada para versão original sem regras de mínimo global';
