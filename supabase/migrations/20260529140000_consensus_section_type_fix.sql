-- Consenso: corrigir section_type no gabarito provisório para pontuação por disciplina

CREATE OR REPLACE FUNCTION public.get_section_type_for_question(
  p_disciplines jsonb,
  p_question_number integer
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_blocks jsonb;
  v_block jsonb;
  v_discipline jsonb;
  v_current_index integer := 1;
  v_question_count integer;
  v_is_enabled boolean;
BEGIN
  IF p_disciplines IS NULL OR p_question_number IS NULL OR p_question_number < 1 THEN
    RETURN 'basic';
  END IF;

  IF jsonb_typeof(p_disciplines) = 'object' AND p_disciplines ? 'blocks' THEN
    v_blocks := p_disciplines->'blocks';
  ELSIF jsonb_typeof(p_disciplines) = 'array' THEN
    v_blocks := p_disciplines;
  ELSE
    RETURN 'basic';
  END IF;

  IF v_blocks IS NULL OR jsonb_typeof(v_blocks) <> 'array' OR jsonb_array_length(v_blocks) = 0 THEN
    RETURN 'basic';
  END IF;

  FOR v_block IN SELECT value FROM jsonb_array_elements(v_blocks)
  LOOP
    IF v_block ? 'disciplines' AND jsonb_typeof(v_block->'disciplines') = 'array' THEN
      FOR v_discipline IN SELECT value FROM jsonb_array_elements(v_block->'disciplines')
      LOOP
        v_is_enabled := COALESCE((v_discipline->>'isEnabled')::boolean, false);
        IF v_is_enabled THEN
          v_question_count := CASE jsonb_typeof(v_discipline->'questionCount')
            WHEN 'number' THEN GREATEST((v_discipline->>'questionCount')::integer, 0)
            WHEN 'string' THEN GREATEST(COALESCE(NULLIF(trim(v_discipline->>'questionCount'), '')::integer, 0), 0)
            ELSE 0
          END;

          IF p_question_number >= v_current_index
             AND p_question_number < v_current_index + v_question_count THEN
            RETURN COALESCE(NULLIF(trim(v_discipline->>'type'), ''), 'basic');
          END IF;

          v_current_index := v_current_index + v_question_count;
        END IF;
      END LOOP;
    END IF;
  END LOOP;

  RETURN 'basic';
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_gabarito_section_type(
  p_gabarito_section_type text,
  p_disciplines jsonb,
  p_question_number integer
)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN NULLIF(trim(p_gabarito_section_type), '') IS NOT NULL
         AND trim(p_gabarito_section_type) <> 'default'
    THEN trim(p_gabarito_section_type)
    ELSE public.get_section_type_for_question(p_disciplines, p_question_number)
  END;
$$;

CREATE OR REPLACE FUNCTION public.rebuild_provisional_gabarito(p_concurso_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_leader record;
  v_booklet_answers jsonb;
  v_provisional jsonb := '{}'::jsonb;
  v_official jsonb;
  v_disciplines jsonb;
  v_exam_type text;
  v_question_type text;
  v_template jsonb;
  v_entry jsonb;
  v_count integer := 0;
BEGIN
  SELECT official_answers, exam_type, disciplines
  INTO v_official, v_exam_type, v_disciplines
  FROM concursos
  WHERE id = p_concurso_id;

  v_question_type := CASE WHEN v_exam_type = 'Certo ou Errado' THEN 'TRUE_FALSE' ELSE 'MULTIPLE_CHOICE' END;

  FOR v_leader IN
    SELECT booklet_id, question_number, leader_answer, leader_votes
    FROM provisional_gabarito_leaders
    WHERE concurso_id = p_concurso_id
    ORDER BY booklet_id, question_number
  LOOP
    v_template := COALESCE(
      v_official->v_leader.booklet_id->'answers'->(v_leader.question_number::text),
      v_official->v_leader.booklet_id->'questions'->(v_leader.question_number::text),
      '{}'::jsonb
    );

    v_entry := jsonb_build_object(
      'correct_answer', v_leader.leader_answer,
      'weight', COALESCE((v_template->>'weight')::numeric, 1),
      'section_type', resolve_gabarito_section_type(
        v_template->>'section_type',
        v_disciplines,
        v_leader.question_number
      ),
      'is_nullified', COALESCE((v_template->>'is_nullified')::boolean, false),
      'answer_format', COALESCE(v_template->>'answer_format', 'OBJECTIVE'),
      'question_type', COALESCE(v_template->>'question_type', v_question_type),
      'consensus_votes', v_leader.leader_votes
    );

    IF NOT (v_provisional ? v_leader.booklet_id) THEN
      v_provisional := jsonb_set(
        v_provisional,
        ARRAY[v_leader.booklet_id],
        jsonb_build_object(
          'answers', '{}'::jsonb,
          'metadata', jsonb_build_object('source', 'consensus', 'last_updated', now())
        )
      );
    END IF;

    v_booklet_answers := v_provisional->v_leader.booklet_id->'answers';
    v_booklet_answers := jsonb_set(v_booklet_answers, ARRAY[v_leader.question_number::text], v_entry);
    v_provisional := jsonb_set(
      v_provisional,
      ARRAY[v_leader.booklet_id, 'answers'],
      v_booklet_answers
    );
    v_count := v_count + 1;
  END LOOP;

  UPDATE concursos
  SET provisional_answers = v_provisional,
      updated_at = now()
  WHERE id = p_concurso_id;

  RETURN jsonb_build_object('success', true, 'questions_built', v_count);
END;
$$;

COMMENT ON FUNCTION public.get_section_type_for_question IS
  'Resolve o type da disciplina para um número de questão (espelha getSectionTypeForQuestion no frontend).';

COMMENT ON FUNCTION public.resolve_gabarito_section_type IS
  'Usa section_type do gabarito oficial ou infere pela estrutura disciplines do concurso.';


CREATE OR REPLACE FUNCTION public.calculate_user_score_realtime(
  p_ranking_id text,
  p_user_id uuid,
  p_concurso_id uuid,
  p_selected_booklet text
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_user_answers jsonb;
  v_official_answers jsonb;
  v_score numeric := 0;
  v_objective_score numeric := 0;
  v_question_key text;
  v_user_answer text;
  v_correct_answer text;
  v_weight numeric;
  v_is_nullified boolean;
  v_section_type text;
  v_consolidated_data jsonb;
  v_user_ranking_data jsonb;
  v_selected_booklet text;
  v_concurso_data jsonb;
  v_subjects jsonb;
  v_has_cota jsonb;
  v_disciplines jsonb;
  v_section_key text;
  v_exam_type text;
  v_wrong_answer_penalty numeric := 0;
  v_discipline_weights jsonb := '{}'::jsonb;
  v_discipline_weight numeric := 1;
  v_object_scores jsonb := '{}'::jsonb;
  v_weighted_object_scores jsonb := '{}'::jsonb;
  v_discipline_record jsonb;
  v_discipline_type text;
  v_discipline_score numeric;
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
  v_has_global_minimum boolean := false;
  v_global_minimum_score numeric := 0;
  v_below_minimum boolean := false;
  v_elimination_reasons text[] := '{}'::text[];
  v_final_status text := 'classificado';
  v_below_discipline_minimums text[] := '{}'::text[];
  v_below_block_minimums text[] := '{}'::text[];
  v_discipline_key text;
  v_discipline_score_for_minimum numeric;
  v_discipline_minimum numeric;
  v_block_record jsonb;
  v_block_id text;
  v_block_score numeric;
  v_block_minimum numeric;
  v_quota_type text;
  v_is_quota boolean := false;
  v_quota_minimum numeric;
  v_quota_below_minimum boolean := false;
  v_use_weighted_scoring boolean := true;
  v_calculation_log jsonb;
  v_gabarito_status text;
BEGIN
  PERFORM set_config('row_security', 'off', true);
  
  v_calculation_log := jsonb_build_object(
    'function', 'calculate_user_score_realtime',
    'ranking_id', p_ranking_id,
    'user_id', p_user_id,
    'concurso_id', p_concurso_id,
    'booklet_id', p_selected_booklet,
    'timestamp', NOW(),
    'step', 'start'
  );
  
  SELECT consolidated_data INTO v_consolidated_data
  FROM user_rankings
  WHERE user_id = p_user_id
  LIMIT 1;

  IF v_consolidated_data IS NULL THEN
    PERFORM set_config('row_security', 'on', true);
    RETURN 0;
  END IF;

  v_user_ranking_data := v_consolidated_data->'rankings'->p_ranking_id;
  
  IF v_user_ranking_data IS NULL THEN
    PERFORM set_config('row_security', 'on', true);
    RETURN 0;
  END IF;

  v_selected_booklet := COALESCE(v_user_ranking_data->>'selected_booklet_id', p_selected_booklet);

  v_user_answers := v_user_ranking_data->'user_data'->'answers';
  
  IF v_user_answers IS NULL THEN
    PERFORM set_config('row_security', 'on', true);
    RETURN 0;
  END IF;

  -- ✅ CORREÇÃO CRÍTICA: Normalizar reservation_type usando função auxiliar
  v_quota_type := normalize_reservation_type(v_user_ranking_data->'user_data'->>'reservation_type');
  v_is_quota := (v_quota_type IS NOT NULL AND v_quota_type != 'Ampla Concorrência');

  SELECT gabarito_status, subjects, has_cota, disciplines, exam_type
  INTO v_gabarito_status, v_subjects, v_has_cota, v_disciplines, v_exam_type
  FROM concursos
  WHERE id = p_concurso_id
  LIMIT 1;

  v_use_weighted_scoring := (v_exam_type != 'Certo ou Errado');

  IF v_disciplines IS NOT NULL THEN
    v_wrong_answer_penalty := COALESCE((v_disciplines->>'wrong_answer_penalty')::numeric, 0);
    IF v_disciplines ? 'blocks' THEN
      FOR v_block_record IN SELECT * FROM jsonb_array_elements(v_disciplines->'blocks')
      LOOP
        IF v_block_record ? 'disciplines' AND jsonb_typeof(v_block_record->'disciplines') = 'array' THEN
          FOR v_discipline_record IN SELECT * FROM jsonb_array_elements(v_block_record->'disciplines')
          LOOP
            IF COALESCE((v_discipline_record->>'isEnabled')::boolean, false) THEN
              v_discipline_type := v_discipline_record->>'type';
              v_discipline_weight := COALESCE((v_discipline_record->>'weight')::numeric, 1);
              v_discipline_weights := jsonb_set(v_discipline_weights, ARRAY[v_discipline_type], to_jsonb(v_discipline_weight));
            END IF;
          END LOOP;
        END IF;
      END LOOP;
    END IF;
  END IF;

  v_official_answers := get_active_gabarito_answers(p_concurso_id, v_selected_booklet);

  IF v_official_answers IS NULL OR v_official_answers = '{}'::jsonb THEN
    PERFORM set_config('row_security', 'on', true);
    RETURN 0;
  END IF;

  IF v_disciplines IS NOT NULL THEN
    IF v_is_quota THEN
      v_global_minimum_score := COALESCE((v_disciplines->>'minimum_total_score_cotas')::numeric, 0);
    ELSE
      v_global_minimum_score := COALESCE((v_disciplines->>'minimum_total_score')::numeric, 0);
    END IF;
    v_has_global_minimum := (v_global_minimum_score > 0);
  END IF;

  IF v_subjects IS NOT NULL THEN
    v_has_discursive := COALESCE((v_subjects->>'discr')::boolean, false);
    v_has_case_study_1 := COALESCE((v_subjects->>'case1')::boolean, false);
    v_has_case_study_2 := COALESCE((v_subjects->>'case2')::boolean, false);
    v_has_case_study_3 := COALESCE((v_subjects->>'case3')::boolean, false);
    v_has_other_subjective := COALESCE((v_subjects->>'other')::boolean, false);
    IF v_is_quota THEN
      v_discursive_min_score := COALESCE((v_subjects->>'discr_min_score_cotas')::numeric, 0);
      v_case_study_1_min_score := COALESCE((v_subjects->>'case1_min_score_cotas')::numeric, 0);
      v_case_study_2_min_score := COALESCE((v_subjects->>'case2_min_score_cotas')::numeric, 0);
      v_case_study_3_min_score := COALESCE((v_subjects->>'case3_min_score_cotas')::numeric, 0);
      v_other_subjective_min_score := COALESCE((v_subjects->>'other_min_score_cotas')::numeric, 0);
    ELSE
      v_discursive_min_score := COALESCE((v_subjects->>'discr_min_score')::numeric, 0);
      v_case_study_1_min_score := COALESCE((v_subjects->>'case1_min_score')::numeric, 0);
      v_case_study_2_min_score := COALESCE((v_subjects->>'case2_min_score')::numeric, 0);
      v_case_study_3_min_score := COALESCE((v_subjects->>'case3_min_score')::numeric, 0);
      v_other_subjective_min_score := COALESCE((v_subjects->>'other_min_score')::numeric, 0);
    END IF;
  END IF;

  v_discursive_score := COALESCE((v_user_ranking_data->'user_data'->'subjectives'->>'discursive')::numeric, 0);
  v_case_study_1_score := COALESCE((v_user_ranking_data->'user_data'->'subjectives'->>'case_study_1')::numeric, 0);
  v_case_study_2_score := COALESCE((v_user_ranking_data->'user_data'->'subjectives'->>'case_study_2')::numeric, 0);
  v_case_study_3_score := COALESCE((v_user_ranking_data->'user_data'->'subjectives'->>'case_study_3')::numeric, 0);
  v_other_subjective_score := COALESCE((v_user_ranking_data->'user_data'->'subjectives'->>'other_subjective')::numeric, 0);

  IF v_disciplines IS NOT NULL AND v_disciplines ? 'blocks' THEN
    FOR v_discipline_record IN 
      SELECT jsonb_array_elements(block->'disciplines')
      FROM jsonb_array_elements(v_disciplines->'blocks') AS block
      WHERE (block->>'blockId') IS NOT NULL
    LOOP
      IF COALESCE((v_discipline_record->>'isEnabled')::boolean, false) THEN
        v_discipline_type := v_discipline_record->>'type';
        v_discipline_score := 0;
        v_discipline_weight := COALESCE((v_discipline_weights->>v_discipline_type)::numeric, 1);
        
        FOR v_question_key IN SELECT jsonb_object_keys(v_official_answers)
        LOOP
          v_section_type := resolve_gabarito_section_type(
            v_official_answers->v_question_key->>'section_type',
            v_disciplines,
            v_question_key::integer
          );
          IF v_section_type = v_discipline_type THEN
            v_user_answer := NULL;
            IF v_user_answers ? v_selected_booklet AND v_user_answers->v_selected_booklet IS NOT NULL THEN
              FOR v_section_key IN SELECT jsonb_object_keys(v_user_answers->v_selected_booklet)
              LOOP
                IF v_user_answers->v_selected_booklet->v_section_key ? v_question_key THEN
                  v_user_answer := v_user_answers->v_selected_booklet->v_section_key->>v_question_key;
                  EXIT;
                END IF;
              END LOOP;
            END IF;
            v_correct_answer := v_official_answers->v_question_key->>'correct_answer';
            v_weight := COALESCE((v_official_answers->v_question_key->>'weight')::numeric, 1);
            v_is_nullified := COALESCE((v_official_answers->v_question_key->>'is_nullified')::boolean, false);
            IF v_correct_answer IS NOT NULL THEN
              IF v_is_nullified THEN
                v_discipline_score := v_discipline_score + v_weight;
              ELSIF v_user_answer IS NULL OR TRIM(v_user_answer) = '' THEN
                NULL;
              ELSIF UPPER(v_user_answer) = UPPER(v_correct_answer) THEN
                v_discipline_score := v_discipline_score + v_weight;
              ELSE
                IF v_exam_type = 'Certo ou Errado' AND v_wrong_answer_penalty > 0 THEN
                  v_discipline_score := v_discipline_score - v_wrong_answer_penalty;
                END IF;
              END IF;
            END IF;
          END IF;
        END LOOP;
        
        v_object_scores := jsonb_set(v_object_scores, ARRAY[v_discipline_type], to_jsonb(v_discipline_score));
        IF v_use_weighted_scoring THEN
          v_weighted_object_scores := jsonb_set(v_weighted_object_scores, ARRAY[v_discipline_type], to_jsonb(v_discipline_score * v_discipline_weight));
        ELSE
          v_weighted_object_scores := jsonb_set(v_weighted_object_scores, ARRAY[v_discipline_type], to_jsonb(v_discipline_score));
        END IF;
      END IF;
    END LOOP;
  END IF;

  FOR v_question_key IN SELECT jsonb_object_keys(v_official_answers)
  LOOP
    v_user_answer := NULL;
    IF v_user_answers ? v_selected_booklet AND v_user_answers->v_selected_booklet IS NOT NULL THEN
      FOR v_section_key IN SELECT jsonb_object_keys(v_user_answers->v_selected_booklet)
      LOOP
        IF v_user_answers->v_selected_booklet->v_section_key ? v_question_key THEN
          v_user_answer := v_user_answers->v_selected_booklet->v_section_key->>v_question_key;
          EXIT;
        END IF;
      END LOOP;
    END IF;
    v_correct_answer := v_official_answers->v_question_key->>'correct_answer';
    v_weight := COALESCE((v_official_answers->v_question_key->>'weight')::numeric, 1);
    v_is_nullified := COALESCE((v_official_answers->v_question_key->>'is_nullified')::boolean, false);
    v_section_type := resolve_gabarito_section_type(
            v_official_answers->v_question_key->>'section_type',
            v_disciplines,
            v_question_key::integer
          );
    v_discipline_weight := COALESCE((v_discipline_weights->>v_section_type)::numeric, 1);
    
    IF v_correct_answer IS NOT NULL THEN
      IF v_is_nullified THEN
        IF v_use_weighted_scoring THEN
          v_objective_score := v_objective_score + (v_weight * v_discipline_weight);
          v_score := v_score + (v_weight * v_discipline_weight);
        ELSE
          v_objective_score := v_objective_score + v_weight;
          v_score := v_score + v_weight;
        END IF;
      ELSIF v_user_answer IS NULL OR TRIM(v_user_answer) = '' THEN
        NULL;
      ELSIF UPPER(v_user_answer) = UPPER(v_correct_answer) THEN
        IF v_use_weighted_scoring THEN
          v_objective_score := v_objective_score + (v_weight * v_discipline_weight);
          v_score := v_score + (v_weight * v_discipline_weight);
        ELSE
          v_objective_score := v_objective_score + v_weight;
          v_score := v_score + v_weight;
        END IF;
      ELSE
        IF v_exam_type = 'Certo ou Errado' AND v_wrong_answer_penalty > 0 THEN
          v_objective_score := v_objective_score - v_wrong_answer_penalty;
          v_score := v_score - v_wrong_answer_penalty;
        END IF;
      END IF;
    END IF;
  END LOOP;

  DECLARE
    v_discursive_weight numeric := COALESCE((v_discipline_weights->>'discursive')::numeric, 1);
    v_case_study_1_weight numeric := COALESCE((v_discipline_weights->>'case_study_1')::numeric, 1);
    v_case_study_2_weight numeric := COALESCE((v_discipline_weights->>'case_study_2')::numeric, 1);
    v_case_study_3_weight numeric := COALESCE((v_discipline_weights->>'case_study_3')::numeric, 1);
    v_other_subjective_weight numeric := COALESCE((v_discipline_weights->>'other_subjective')::numeric, 1);
  BEGIN
    IF v_has_discursive THEN
      IF v_use_weighted_scoring THEN
        v_score := v_score + (v_discursive_score * v_discursive_weight);
      ELSE
        v_score := v_score + v_discursive_score;
      END IF;
    END IF;
    IF v_has_case_study_1 THEN
      IF v_use_weighted_scoring THEN
        v_score := v_score + (v_case_study_1_score * v_case_study_1_weight);
      ELSE
        v_score := v_score + v_case_study_1_score;
      END IF;
    END IF;
    IF v_has_case_study_2 THEN
      IF v_use_weighted_scoring THEN
        v_score := v_score + (v_case_study_2_score * v_case_study_2_weight);
      ELSE
        v_score := v_score + v_case_study_2_score;
      END IF;
    END IF;
    IF v_has_case_study_3 THEN
      IF v_use_weighted_scoring THEN
        v_score := v_score + (v_case_study_3_score * v_case_study_3_weight);
      ELSE
        v_score := v_score + v_case_study_3_score;
      END IF;
    END IF;
    IF v_has_other_subjective THEN
      IF v_use_weighted_scoring THEN
        v_score := v_score + (v_other_subjective_score * v_other_subjective_weight);
      ELSE
        v_score := v_score + v_other_subjective_score;
      END IF;
    END IF;
  END;

  IF v_has_global_minimum AND v_global_minimum_score > 0 AND v_objective_score < v_global_minimum_score THEN
    v_below_minimum := true;
    v_elimination_reasons := array_append(v_elimination_reasons, 'Abaixo do mínimo global (objetivo): ' || v_objective_score || ' < ' || v_global_minimum_score);
  END IF;
  
  IF v_has_discursive AND v_discursive_min_score > 0 AND v_discursive_score < v_discursive_min_score THEN
    v_below_minimum := true;
    v_below_discipline_minimums := array_append(v_below_discipline_minimums, 'discursive');
    v_elimination_reasons := array_append(v_elimination_reasons, 'Mínimo discursiva: ' || v_discursive_score || ' < ' || v_discursive_min_score);
  END IF;
  
  IF v_has_case_study_1 AND v_case_study_1_min_score > 0 AND v_case_study_1_score < v_case_study_1_min_score THEN
    v_below_minimum := true;
    v_below_discipline_minimums := array_append(v_below_discipline_minimums, 'case_study_1');
    v_elimination_reasons := array_append(v_elimination_reasons, 'Mínimo caso 1: ' || v_case_study_1_score || ' < ' || v_case_study_1_min_score);
  END IF;
  
  IF v_has_case_study_2 AND v_case_study_2_min_score > 0 AND v_case_study_2_score < v_case_study_2_min_score THEN
    v_below_minimum := true;
    v_below_discipline_minimums := array_append(v_below_discipline_minimums, 'case_study_2');
    v_elimination_reasons := array_append(v_elimination_reasons, 'Mínimo caso 2: ' || v_case_study_2_score || ' < ' || v_case_study_2_min_score);
  END IF;
  
  IF v_has_case_study_3 AND v_case_study_3_min_score > 0 AND v_case_study_3_score < v_case_study_3_min_score THEN
    v_below_minimum := true;
    v_below_discipline_minimums := array_append(v_below_discipline_minimums, 'case_study_3');
    v_elimination_reasons := array_append(v_elimination_reasons, 'Mínimo caso 3: ' || v_case_study_3_score || ' < ' || v_case_study_3_min_score);
  END IF;
  
  IF v_has_other_subjective AND v_other_subjective_min_score > 0 AND v_other_subjective_score < v_other_subjective_min_score THEN
    v_below_minimum := true;
    v_below_discipline_minimums := array_append(v_below_discipline_minimums, 'other_subjective');
    v_elimination_reasons := array_append(v_elimination_reasons, 'Mínimo subjetivo: ' || v_other_subjective_score || ' < ' || v_other_subjective_min_score);
  END IF;
  
  IF v_disciplines IS NOT NULL AND v_disciplines ? 'blocks' THEN
    FOR v_block_record IN SELECT jsonb_array_elements(v_disciplines->'blocks')
    LOOP
      IF v_block_record->>'blockId' IS NOT NULL THEN
        IF v_block_record ? 'disciplines' AND jsonb_typeof(v_block_record->'disciplines') = 'array' THEN
          FOR v_discipline_record IN SELECT jsonb_array_elements(v_block_record->'disciplines')
          LOOP
            IF COALESCE((v_discipline_record->>'isEnabled')::boolean, false) THEN
              v_discipline_type := v_discipline_record->>'type';
              IF v_is_quota THEN
                v_discipline_minimum := COALESCE((v_discipline_record->>'minimum_score_cotas')::numeric, 0);
              ELSE
                v_discipline_minimum := COALESCE((v_discipline_record->>'minimum_score')::numeric, 0);
              END IF;
              IF v_discipline_minimum > 0 THEN
                v_discipline_score_for_minimum := COALESCE((v_object_scores->>v_discipline_type)::numeric, 0);
                IF v_discipline_score_for_minimum < v_discipline_minimum THEN
                  v_below_minimum := true;
                  v_below_discipline_minimums := array_append(v_below_discipline_minimums, v_discipline_type);
                  v_elimination_reasons := array_append(v_elimination_reasons, 'Mínimo ' || v_discipline_type || ': ' || v_discipline_score_for_minimum || ' < ' || v_discipline_minimum);
                END IF;
              END IF;
            END IF;
          END LOOP;
        END IF;
      END IF;
    END LOOP;
  END IF;
  
  IF v_disciplines IS NOT NULL AND v_disciplines ? 'blocks' THEN
    FOR v_block_record IN SELECT * FROM jsonb_array_elements(v_disciplines->'blocks')
    LOOP
      v_block_id := v_block_record->>'blockId';
      IF v_block_id IS NOT NULL THEN
        IF v_is_quota THEN
          v_block_minimum := COALESCE((v_block_record->>'blockMinimumCotas')::numeric, (v_block_record->>'minimum_score_cotas')::numeric, 0);
        ELSE
          v_block_minimum := COALESCE((v_block_record->>'blockMinimumScore')::numeric, (v_block_record->>'minimum_score')::numeric, 0);
        END IF;
        IF v_block_minimum > 0 THEN
          v_block_score := 0;
          IF v_block_record ? 'disciplines' AND jsonb_typeof(v_block_record->'disciplines') = 'array' THEN
            FOR v_discipline_record IN SELECT * FROM jsonb_array_elements(v_block_record->'disciplines')
            LOOP
              IF COALESCE((v_discipline_record->>'isEnabled')::boolean, false) THEN
                v_discipline_type := v_discipline_record->>'type';
                v_block_score := v_block_score + COALESCE((v_object_scores->>v_discipline_type)::numeric, 0);
              END IF;
            END LOOP;
          END IF;
          IF v_block_score < v_block_minimum THEN
            v_below_minimum := true;
            v_below_block_minimums := array_append(v_below_block_minimums, v_block_id);
            v_elimination_reasons := array_append(v_elimination_reasons, 'Mínimo bloco ' || v_block_id || ': ' || v_block_score || ' < ' || v_block_minimum);
          END IF;
        END IF;
      END IF;
    END LOOP;
  END IF;
  
  IF v_has_cota IS NOT NULL THEN
    IF v_quota_type IS NOT NULL AND v_has_cota ? v_quota_type THEN
      v_quota_minimum := COALESCE((v_has_cota->v_quota_type->>'minimum_score')::numeric, 0);
      IF v_quota_minimum > 0 AND v_score < v_quota_minimum THEN
        v_below_minimum := true;
        v_elimination_reasons := array_append(v_elimination_reasons, 'Mínimo cota ' || v_quota_type || ': ' || v_score || ' < ' || v_quota_minimum);
      END IF;
    END IF;
  END IF;
  
  IF v_below_minimum THEN
    v_final_status := 'eliminado';
  ELSE
    v_final_status := 'classificado';
  END IF;

  v_consolidated_data := jsonb_set(v_consolidated_data, ARRAY['rankings', p_ranking_id, 'user_data', 'score'], to_jsonb(v_score));
  v_consolidated_data := jsonb_set(v_consolidated_data, ARRAY['rankings', p_ranking_id, 'user_data', 'below_minimum'], to_jsonb(v_below_minimum));
  v_consolidated_data := jsonb_set(v_consolidated_data, ARRAY['rankings', p_ranking_id, 'user_data', 'belowMinimum'], to_jsonb(v_below_minimum));
  v_consolidated_data := jsonb_set(v_consolidated_data, ARRAY['rankings', p_ranking_id, 'user_data', 'status'], to_jsonb(v_final_status));
  v_consolidated_data := jsonb_set(v_consolidated_data, ARRAY['rankings', p_ranking_id, 'user_data', 'elimination_reasons'], to_jsonb(v_elimination_reasons));
  v_consolidated_data := jsonb_set(v_consolidated_data, ARRAY['rankings', p_ranking_id, 'user_data', 'belowDisciplineMinimums'], array_to_json(v_below_discipline_minimums)::jsonb);
  v_consolidated_data := jsonb_set(v_consolidated_data, ARRAY['rankings', p_ranking_id, 'user_data', 'belowBlockMinimums'], array_to_json(v_below_block_minimums)::jsonb);
  v_consolidated_data := jsonb_set(v_consolidated_data, ARRAY['rankings', p_ranking_id, 'user_data', 'object_scores'], v_object_scores);
  v_consolidated_data := jsonb_set(v_consolidated_data, ARRAY['rankings', p_ranking_id, 'user_data', 'weightedCustomDisciplineScores'], v_weighted_object_scores);
  v_consolidated_data := jsonb_set(v_consolidated_data, ARRAY['rankings', p_ranking_id, 'user_data', 'score_source'], to_jsonb(CASE WHEN COALESCE(v_gabarito_status, 'consensus') = 'consensus' THEN 'consensus' ELSE 'official' END));
  v_consolidated_data := jsonb_set(v_consolidated_data, ARRAY['rankings', p_ranking_id, 'user_data', 'last_calculated'], to_jsonb(now()::text));
  
  UPDATE user_rankings
  SET consolidated_data = v_consolidated_data
  WHERE user_id = p_user_id;

  v_calculation_log := v_calculation_log || jsonb_build_object(
    'step', 'completed',
    'result', jsonb_build_object(
      'score', v_score,
      'objective_score', v_objective_score,
      'below_minimum', v_below_minimum,
      'status', v_final_status,
      'elimination_reasons', array_to_json(v_elimination_reasons)::jsonb,
      'below_discipline_minimums', array_to_json(v_below_discipline_minimums)::jsonb,
      'below_block_minimums', array_to_json(v_below_block_minimums)::jsonb,
      'object_scores', v_object_scores,
      'weighted_object_scores', v_weighted_object_scores,
      'global_minimum', v_global_minimum_score,
      'has_global_minimum', v_has_global_minimum,
      'is_quota', v_is_quota,
      'quota_type', v_quota_type,
      'exam_type', v_exam_type,
      'wrong_answer_penalty', v_wrong_answer_penalty,
      'use_weighted_scoring', v_use_weighted_scoring,
      'discipline_weights', v_discipline_weights
    )
  );
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'score_calculation_logs') THEN
    INSERT INTO score_calculation_logs (user_ranking_id, calculation_type, calculation_details)
    VALUES (NULL, 'calculate_user_score_realtime', v_calculation_log);
  END IF;

  PERFORM set_config('row_security', 'on', true);
  RETURN v_score;
EXCEPTION
  WHEN OTHERS THEN
    PERFORM set_config('row_security', 'on', true);
    RAISE;
END;
$function$;

COMMENT ON FUNCTION public.calculate_user_score_realtime IS 'Calcula score usando gabarito oficial ou provisório (consenso) via get_active_gabarito_answers.';

-- Recalcular gabaritos provisórios e pontuações em rankings em modo consenso
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT id
    FROM concursos
    WHERE COALESCE(gabarito_status, 'consensus') = 'consensus'
      AND EXISTS (
        SELECT 1
        FROM provisional_gabarito_leaders pgl
        WHERE pgl.concurso_id = concursos.id
      )
  LOOP
    PERFORM rebuild_provisional_gabarito(r.id);
    PERFORM recalculate_all_scores_with_weights(r.id);
  END LOOP;
END $$;
