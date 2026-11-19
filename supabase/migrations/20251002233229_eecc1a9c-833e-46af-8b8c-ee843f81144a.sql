-- Prefer consolidated selected_booklet when available and ensure C/E penalty = -weight
CREATE OR REPLACE FUNCTION public.calculate_user_score_realtime(p_ranking_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_total_score NUMERIC := 0;
  v_concurso_id UUID;
  v_user_id UUID;
  v_selected_booklet TEXT;
  v_consolidated_selected TEXT;
  v_concurso RECORD;
  v_basic_score NUMERIC := 0;
  v_specific1_score NUMERIC := 0;
  v_specific2_score NUMERIC := 0;
  v_specific3_score NUMERIC := 0;
  v_discursive_score NUMERIC := 0;
  v_case_study1_score NUMERIC := 0;
  v_case_study2_score NUMERIC := 0;
  v_case_study3_score NUMERIC := 0;
  v_subject_scores JSONB := '{}'::jsonb;
  v_weighted_subject_scores JSONB := '{}'::jsonb;
  v_has_custom_knowledge BOOLEAN := FALSE;
  v_disciplines JSONB;
  v_consolidated_data JSONB;
  v_user_answers JSONB;
  v_official_answers JSONB;
  v_exam_type TEXT;
  v_wrong_answer_penalty NUMERIC := 0; -- not used for C/E; kept for compatibility

  v_block JSONB;
  v_discipline JSONB;
  v_discipline_type TEXT;
  v_discipline_weight NUMERIC;
  v_discipline_score NUMERIC;
  v_custom_discipline_scores JSONB := '{}'::jsonb;
  v_weighted_custom_discipline_scores JSONB := '{}'::jsonb;

  v_question_num TEXT;
  v_official_answer_data JSONB;
  v_user_answer TEXT;
  v_correct_answer TEXT;
  v_section_type TEXT;
  v_weight NUMERIC;
  v_is_nullified BOOLEAN;
  v_points_if_wrong NUMERIC;
  v_question_type TEXT;
BEGIN
  -- Get ranking and concurso data (selected_booklet from user_rankings as fallback)
  SELECT
    ur.concurso_id,
    ur.user_id,
    ur.selected_booklet::text,
    COALESCE(ur.discursive_score, 0),
    COALESCE(ur.case_study_1_score, 0),
    COALESCE(ur.case_study_2_score, 0),
    COALESCE(ur.case_study_3_score, 0),
    c.has_custom_knowledge,
    c.disciplines,
    c.exam_type,
    COALESCE(c.wrong_answer_penalty, 0)
  INTO
    v_concurso_id,
    v_user_id,
    v_selected_booklet,
    v_discursive_score,
    v_case_study1_score,
    v_case_study2_score,
    v_case_study3_score,
    v_has_custom_knowledge,
    v_disciplines,
    v_exam_type,
    v_wrong_answer_penalty
  FROM user_rankings ur
  JOIN concursos c ON c.id = ur.concurso_id
  WHERE ur.id = p_ranking_id;

  IF v_concurso_id IS NULL THEN
    RETURN 0;
  END IF;

  -- Load consolidated data for concurso
  SELECT consolidated_data INTO v_consolidated_data
  FROM consolidated_answers_by_concurso
  WHERE concurso_id = v_concurso_id;

  IF v_consolidated_data IS NULL THEN
    RETURN 0;
  END IF;

  -- Prefer user's consolidated selected_booklet when available
  v_consolidated_selected := NULLIF(COALESCE(
    v_consolidated_data->'users'->v_user_id::text->>'selected_booklet',
    ''
  ), '');

  IF v_consolidated_selected IS NOT NULL THEN
    v_selected_booklet := v_consolidated_selected;
  END IF;

  -- If after consolidation we still don't have a selected booklet, return 0
  IF v_selected_booklet IS NULL OR TRIM(v_selected_booklet) = '' THEN
    RETURN 0;
  END IF;

  -- Extract user answers for the selected booklet
  v_user_answers := v_consolidated_data->'users'->v_user_id::text->'booklets'->v_selected_booklet->'answers';
  IF v_user_answers IS NULL THEN
    RETURN 0;
  END IF;

  -- Load official answers for selected booklet
  SELECT consolidated_answer_data INTO v_official_answers
  FROM official_answer_weights
  WHERE concurso_id = v_concurso_id;

  v_official_answers := v_official_answers->'booklets'->v_selected_booklet->'answers';
  IF v_official_answers IS NULL THEN
    RETURN 0;
  END IF;

  -- Concurso weights
  SELECT
    basic_knowledge_weight,
    specific_knowledge_1_weight,
    specific_knowledge_2_weight,
    specific_knowledge_3_weight,
    discursive_weight,
    case_study_1_weight,
    case_study_2_weight,
    case_study_3_weight
  INTO v_concurso
  FROM concursos
  WHERE id = v_concurso_id;

  IF v_has_custom_knowledge IS TRUE AND v_disciplines IS NOT NULL AND jsonb_array_length(v_disciplines) > 0 THEN
    v_custom_discipline_scores := '{}'::jsonb;
    v_weighted_custom_discipline_scores := '{}'::jsonb;
    v_total_score := 0;

    -- Hierarchical structure (blocks -> disciplines)
    FOR v_block IN SELECT * FROM jsonb_array_elements(v_disciplines)
    LOOP
      IF v_block ? 'disciplines' AND v_block->'disciplines' IS NOT NULL THEN
        FOR v_discipline IN SELECT * FROM jsonb_array_elements(v_block->'disciplines')
        LOOP
          IF (v_discipline->>'isEnabled')::boolean IS TRUE THEN
            v_discipline_type := v_discipline->>'type';
            v_discipline_weight := COALESCE((v_discipline->>'weight')::NUMERIC, 1.0);
            v_discipline_score := 0;

            FOR v_question_num IN SELECT key FROM jsonb_object_keys(v_official_answers) AS key
            LOOP
              v_official_answer_data := v_official_answers->v_question_num;
              v_correct_answer := v_official_answer_data->>'correct_answer';
              v_section_type := v_official_answer_data->>'section_type';
              v_weight := COALESCE((v_official_answer_data->>'weight')::NUMERIC, 1.0);
              v_is_nullified := COALESCE((v_official_answer_data->>'is_nullified')::BOOLEAN, false);
              v_points_if_wrong := COALESCE((v_official_answer_data->>'points_if_wrong')::NUMERIC, 0);
              v_question_type := v_official_answer_data->>'question_type';

              v_user_answer := v_user_answers->>v_question_num;

              IF v_section_type = v_discipline_type THEN
                -- Anulada: atribuir pontos = peso
                IF v_is_nullified THEN
                  v_discipline_score := v_discipline_score + v_weight;
                -- Em branco: não pontua nem penaliza
                ELSIF v_user_answer IS NULL OR TRIM(v_user_answer) = '' THEN
                  CONTINUE;
                -- Correta
                ELSIF UPPER(v_user_answer) = UPPER(v_correct_answer) THEN
                  v_discipline_score := v_discipline_score + v_weight;
                -- Errada -> C/E: perde peso
                ELSE
                  IF v_exam_type = 'Certo ou Errado' THEN
                    v_discipline_score := v_discipline_score - v_weight;
                  END IF;
                END IF;
              END IF;
            END LOOP;

            v_subject_scores := jsonb_set(v_subject_scores, ARRAY[v_discipline_type], to_jsonb(v_discipline_score), true);
            v_custom_discipline_scores := jsonb_set(v_custom_discipline_scores, ARRAY[v_discipline_type], to_jsonb(v_discipline_score), true);
            v_weighted_custom_discipline_scores := jsonb_set(v_weighted_custom_discipline_scores, ARRAY[v_discipline_type], to_jsonb(v_discipline_score * v_discipline_weight), true);

            v_total_score := v_total_score + (v_discipline_score * v_discipline_weight);
          END IF;
        END LOOP;
      ELSE
        -- Flat structure
        IF (v_block->>'isEnabled')::boolean IS TRUE THEN
          v_discipline_type := v_block->>'type';
          v_discipline_weight := COALESCE((v_block->>'weight')::NUMERIC, 1.0);
          v_discipline_score := 0;

          FOR v_question_num IN SELECT key FROM jsonb_object_keys(v_official_answers) AS key
          LOOP
            v_official_answer_data := v_official_answers->v_question_num;
            v_correct_answer := v_official_answer_data->>'correct_answer';
            v_section_type := v_official_answer_data->>'section_type';
            v_weight := COALESCE((v_official_answer_data->>'weight')::NUMERIC, 1.0);
            v_is_nullified := COALESCE((v_official_answer_data->>'is_nullified')::BOOLEAN, false);
            v_points_if_wrong := COALESCE((v_official_answer_data->>'points_if_wrong')::NUMERIC, 0);
            v_question_type := v_official_answer_data->>'question_type';

            v_user_answer := v_user_answers->>v_question_num;

            IF v_section_type = v_discipline_type THEN
              IF v_is_nullified THEN
                v_discipline_score := v_discipline_score + v_weight;
              ELSIF v_user_answer IS NULL OR TRIM(v_user_answer) = '' THEN
                CONTINUE;
              ELSIF UPPER(v_user_answer) = UPPER(v_correct_answer) THEN
                v_discipline_score := v_discipline_score + v_weight;
              ELSE
                IF v_exam_type = 'Certo ou Errado' THEN
                  v_discipline_score := v_discipline_score - v_weight;
                END IF;
              END IF;
            END IF;
          END LOOP;

          v_subject_scores := jsonb_set(v_subject_scores, ARRAY[v_discipline_type], to_jsonb(v_discipline_score), true);
          v_custom_discipline_scores := jsonb_set(v_custom_discipline_scores, ARRAY[v_discipline_type], to_jsonb(v_discipline_score), true);
          v_weighted_custom_discipline_scores := jsonb_set(v_weighted_custom_discipline_scores, ARRAY[v_discipline_type], to_jsonb(v_discipline_score * v_discipline_weight), true);

          v_total_score := v_total_score + (v_discipline_score * v_discipline_weight);
        END IF;
      END IF;
    END LOOP;

    -- Add subjective scores
    v_total_score := v_total_score +
      (v_discursive_score * COALESCE(v_concurso.discursive_weight, 1)) +
      (v_case_study1_score * COALESCE(v_concurso.case_study_1_weight, 1)) +
      (v_case_study2_score * COALESCE(v_concurso.case_study_2_weight, 1)) +
      (v_case_study3_score * COALESCE(v_concurso.case_study_3_weight, 1));

    -- Update ranking
    UPDATE user_rankings
    SET
      score = v_total_score,
      subject_scores = v_subject_scores,
      "customDisciplineScores" = v_custom_discipline_scores,
      "weightedCustomDisciplineScores" = v_weighted_custom_discipline_scores,
      basic_knowledge_score = 0,
      specific_knowledge_1_score = 0,
      specific_knowledge_2_score = 0,
      specific_knowledge_3_score = 0,
      specific_knowledge_score = 0,
      weighted_basic_score = 0,
      weighted_specific_1_score = 0,
      weighted_specific_2_score = 0,
      weighted_specific_3_score = 0,
      weighted_discursive_score = v_discursive_score * COALESCE(v_concurso.discursive_weight, 1),
      weighted_case_study_1_score = v_case_study1_score * COALESCE(v_concurso.case_study_1_weight, 1),
      weighted_case_study_2_score = v_case_study2_score * COALESCE(v_concurso.case_study_2_weight, 1),
      weighted_case_study_3_score = v_case_study3_score * COALESCE(v_concurso.case_study_3_weight, 1),
      is_score_recalculated = true,
      updated_at = now()
    WHERE id = p_ranking_id;

  ELSE
    -- Legacy (non-custom) structure
    FOR v_question_num IN SELECT key FROM jsonb_object_keys(v_official_answers) AS key
    LOOP
      v_official_answer_data := v_official_answers->v_question_num;
      v_correct_answer := v_official_answer_data->>'correct_answer';
      v_section_type := v_official_answer_data->>'section_type';
      v_weight := COALESCE((v_official_answer_data->>'weight')::NUMERIC, 1.0);
      v_is_nullified := COALESCE((v_official_answer_data->>'is_nullified')::BOOLEAN, false);
      v_points_if_wrong := COALESCE((v_official_answer_data->>'points_if_wrong')::NUMERIC, 0);
      v_question_type := v_official_answer_data->>'question_type';

      v_user_answer := v_user_answers->>v_question_num;

      IF v_is_nullified THEN
        CASE v_section_type
          WHEN 'basic' THEN v_basic_score := v_basic_score + v_weight;
          WHEN 'specific1' THEN v_specific1_score := v_specific1_score + v_weight;
          WHEN 'specific2' THEN v_specific2_score := v_specific2_score + v_weight;
          WHEN 'specific3' THEN v_specific3_score := v_specific3_score + v_weight;
        END CASE;
      ELSIF v_user_answer IS NULL OR TRIM(v_user_answer) = '' THEN
        CONTINUE;
      ELSIF UPPER(v_user_answer) = UPPER(v_correct_answer) THEN
        CASE v_section_type
          WHEN 'basic' THEN v_basic_score := v_basic_score + v_weight;
          WHEN 'specific1' THEN v_specific1_score := v_specific1_score + v_weight;
          WHEN 'specific2' THEN v_specific2_score := v_specific2_score + v_weight;
          WHEN 'specific3' THEN v_specific3_score := v_specific3_score + v_weight;
        END CASE;
      ELSE
        IF v_exam_type = 'Certo ou Errado' THEN
          CASE v_section_type
            WHEN 'basic' THEN v_basic_score := v_basic_score - v_weight;
            WHEN 'specific1' THEN v_specific1_score := v_specific1_score - v_weight;
            WHEN 'specific2' THEN v_specific2_score := v_specific2_score - v_weight;
            WHEN 'specific3' THEN v_specific3_score := v_specific3_score - v_weight;
          END CASE;
        END IF;
      END IF;
    END LOOP;

    v_total_score :=
      (v_basic_score * COALESCE(v_concurso.basic_knowledge_weight, 1)) +
      (v_specific1_score * COALESCE(v_concurso.specific_knowledge_1_weight, 1)) +
      (v_specific2_score * COALESCE(v_concurso.specific_knowledge_2_weight, 1)) +
      (v_specific3_score * COALESCE(v_concurso.specific_knowledge_3_weight, 1)) +
      (v_discursive_score * COALESCE(v_concurso.discursive_weight, 1)) +
      (v_case_study1_score * COALESCE(v_concurso.case_study_1_weight, 1)) +
      (v_case_study2_score * COALESCE(v_concurso.case_study_2_weight, 1)) +
      (v_case_study_3_score * COALESCE(v_concurso.case_study_3_weight, 1));

    v_subject_scores := jsonb_build_object(
      'basic', v_basic_score,
      'specific1', v_specific1_score,
      'specific2', v_specific2_score,
      'specific3', v_specific3_score
    );

    UPDATE user_rankings
    SET
      basic_knowledge_score = v_basic_score,
      specific_knowledge_1_score = v_specific1_score,
      specific_knowledge_2_score = v_specific2_score,
      specific_knowledge_3_score = v_specific3_score,
      specific_knowledge_score = v_specific1_score + v_specific2_score + v_specific3_score,
      score = v_total_score,
      weighted_basic_score = v_basic_score * COALESCE(v_concurso.basic_knowledge_weight, 1),
      weighted_specific_1_score = v_specific1_score * COALESCE(v_concurso.specific_knowledge_1_weight, 1),
      weighted_specific_2_score = v_specific2_score * COALESCE(v_concurso.specific_knowledge_2_weight, 1),
      weighted_specific_3_score = v_specific3_score * COALESCE(v_concurso.specific_knowledge_3_weight, 1),
      weighted_discursive_score = v_discursive_score * COALESCE(v_concurso.discursive_weight, 1),
      weighted_case_study_1_score = v_case_study1_score * COALESCE(v_concurso.case_study_1_weight, 1),
      weighted_case_study_2_score = v_case_study2_score * COALESCE(v_concurso.case_study_2_weight, 1),
      weighted_case_study_3_score = v_case_study3_score * COALESCE(v_concurso.case_study_3_weight, 1),
      subject_scores = v_subject_scores,
      "customDisciplineScores" = '{}'::jsonb,
      "weightedCustomDisciplineScores" = '{}'::jsonb,
      is_score_recalculated = true,
      updated_at = now()
    WHERE id = p_ranking_id;

  END IF;

  RETURN v_total_score;
END;
$$;