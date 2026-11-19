-- Corrigir a função calculate_user_score_realtime para buscar dados corretos
CREATE OR REPLACE FUNCTION public.calculate_user_score_realtime(p_ranking_id uuid)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_total_score NUMERIC := 0;
  v_concurso_id UUID;
  v_user_id UUID;
  v_selected_booklet TEXT;
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

  -- Declarando variáveis para o bloco DECLARE interno
  v_discipline JSONB;
  v_discipline_type TEXT;
  v_discipline_weight NUMERIC;
  v_discipline_score NUMERIC;
  v_custom_discipline_scores JSONB := '{}'::jsonb;
  v_weighted_custom_discipline_scores JSONB := '{}'::jsonb;

BEGIN
  -- Log Inicial
  INSERT INTO score_calculation_logs (user_ranking_id, calculation_type, calculation_details)
  VALUES (p_ranking_id, 'start_calculation', jsonb_build_object('message', 'Starting calculate_user_score_realtime', 'ranking_id', p_ranking_id, 'timestamp', NOW()));

  -- Obter dados do ranking, concurso e caderno selecionado
  SELECT
    ur.concurso_id,
    ur.user_id,
    ur.selected_booklet,
    COALESCE(ur.discursive_score, 0),
    COALESCE(ur.case_study_1_score, 0),
    COALESCE(ur.case_study_2_score, 0),
    COALESCE(ur.case_study_3_score, 0),
    c.has_custom_knowledge,
    c.disciplines
  INTO
    v_concurso_id,
    v_user_id,
    v_selected_booklet,
    v_discursive_score,
    v_case_study1_score,
    v_case_study2_score,
    v_case_study3_score,
    v_has_custom_knowledge,
    v_disciplines
  FROM user_rankings ur
  JOIN concursos c ON c.id = ur.concurso_id
  WHERE ur.id = p_ranking_id;

  IF v_concurso_id IS NULL THEN
    INSERT INTO score_calculation_logs (user_ranking_id, calculation_type, calculation_details)
    VALUES (p_ranking_id, 'ranking_not_found', jsonb_build_object('message', 'Ranking not found', 'ranking_id', p_ranking_id, 'timestamp', NOW()));
    RETURN 0;
  END IF;

  -- Log: Dados iniciais
  INSERT INTO score_calculation_logs (user_ranking_id, calculation_type, calculation_details)
  VALUES (p_ranking_id, 'initial_data', jsonb_build_object(
    'concurso_id', v_concurso_id, 
    'user_id', v_user_id,
    'selected_booklet', v_selected_booklet,
    'has_custom_knowledge', v_has_custom_knowledge, 
    'timestamp', NOW()
  ));

  -- Buscar dados consolidados do concurso
  SELECT consolidated_data INTO v_consolidated_data
  FROM consolidated_answers_by_concurso
  WHERE concurso_id = v_concurso_id;

  IF v_consolidated_data IS NULL THEN
    INSERT INTO score_calculation_logs (user_ranking_id, calculation_type, calculation_details)
    VALUES (p_ranking_id, 'no_consolidated_data', jsonb_build_object('message', 'No consolidated data found for concurso', 'concurso_id', v_concurso_id, 'timestamp', NOW()));
    RETURN 0;
  END IF;

  -- Extrair respostas do usuário específico do caderno selecionado
  v_user_answers := v_consolidated_data->'users'->v_user_id::text->'booklets'->v_selected_booklet->'answers';

  IF v_user_answers IS NULL THEN
    INSERT INTO score_calculation_logs (user_ranking_id, calculation_type, calculation_details)
    VALUES (p_ranking_id, 'no_user_answers', jsonb_build_object(
      'message', 'No user answers found', 
      'user_id', v_user_id,
      'selected_booklet', v_selected_booklet,
      'timestamp', NOW()
    ));
    RETURN 0;
  END IF;

  -- Log: Respostas encontradas
  INSERT INTO score_calculation_logs (user_ranking_id, calculation_type, calculation_details)
  VALUES (p_ranking_id, 'user_answers_found', jsonb_build_object(
    'user_answers', v_user_answers,
    'timestamp', NOW()
  ));

  -- Obter pesos do concurso
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

  -- Se estiver usando conhecimento customizado
  IF v_has_custom_knowledge IS TRUE AND v_disciplines IS NOT NULL AND jsonb_array_length(v_disciplines) > 0 THEN
    
    v_custom_discipline_scores := '{}'::jsonb;
    v_weighted_custom_discipline_scores := '{}'::jsonb;
    v_total_score := 0;

    INSERT INTO score_calculation_logs (user_ranking_id, calculation_type, calculation_details)
    VALUES (p_ranking_id, 'custom_discipline_processing', jsonb_build_object('disciplines_count', jsonb_array_length(v_disciplines), 'timestamp', NOW()));

    -- Para cada disciplina habilitada
    FOR v_discipline IN SELECT * FROM jsonb_array_elements(v_disciplines)
    LOOP
      IF (v_discipline->>'isEnabled')::boolean IS TRUE THEN
        v_discipline_type := v_discipline->>'type';
        v_discipline_weight := COALESCE((v_discipline->>'weight')::NUMERIC, 1.0);

        -- Calcular pontuação da disciplina usando as respostas do usuário
        SELECT
          COALESCE(SUM(
            CASE
              WHEN oaw.is_nullified OR UPPER((v_user_answers->oaw.question_number::text)::text) = UPPER(oaw.correct_answer)
              THEN oaw.weight
              ELSE 0
            END
          ), 0) INTO v_discipline_score
        FROM
          official_answer_weights oaw
        WHERE
          oaw.concurso_id = v_concurso_id AND
          oaw.section_type = v_discipline_type AND
          v_user_answers ? oaw.question_number::text;

        INSERT INTO score_calculation_logs (user_ranking_id, calculation_type, calculation_details)
        VALUES (p_ranking_id, 'discipline_score_calculated', jsonb_build_object(
          'discipline_type', v_discipline_type,
          'raw_score', v_discipline_score,
          'weight', v_discipline_weight,
          'timestamp', NOW()
        ));

        -- Adicionar às pontuações
        v_subject_scores := jsonb_set(v_subject_scores, ARRAY[v_discipline_type], to_jsonb(v_discipline_score), true);
        v_custom_discipline_scores := jsonb_set(v_custom_discipline_scores, ARRAY[v_discipline_type], to_jsonb(v_discipline_score), true);
        v_weighted_custom_discipline_scores := jsonb_set(v_weighted_custom_discipline_scores, ARRAY[v_discipline_type], to_jsonb(v_discipline_score * v_discipline_weight), true);

        v_total_score := v_total_score + (v_discipline_score * v_discipline_weight);
      END IF;
    END LOOP;

    -- Adicionar pontuações subjetivas
    v_total_score := v_total_score +
      (v_discursive_score * COALESCE(v_concurso.discursive_weight, 1)) +
      (v_case_study1_score * COALESCE(v_concurso.case_study_1_weight, 1)) +
      (v_case_study2_score * COALESCE(v_concurso.case_study_2_weight, 1)) +
      (v_case_study3_score * COALESCE(v_concurso.case_study_3_weight, 1));

    -- Atualizar ranking com pontuações customizadas
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
    -- Abordagem tradicional (não customizada)
    INSERT INTO score_calculation_logs (user_ranking_id, calculation_type, calculation_details)
    VALUES (p_ranking_id, 'traditional_processing', jsonb_build_object('message', 'Processing traditional knowledge sections', 'timestamp', NOW()));

    -- Calcular pontuações objetivas tradicionais usando as respostas do usuário
    SELECT
      COALESCE(SUM(CASE WHEN (oaw.is_nullified OR UPPER((v_user_answers->oaw.question_number::text)::text) = UPPER(oaw.correct_answer)) AND oaw.section_type = 'basic'
          THEN oaw.weight ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN (oaw.is_nullified OR UPPER((v_user_answers->oaw.question_number::text)::text) = UPPER(oaw.correct_answer)) AND oaw.section_type = 'specific1'
          THEN oaw.weight ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN (oaw.is_nullified OR UPPER((v_user_answers->oaw.question_number::text)::text) = UPPER(oaw.correct_answer)) AND oaw.section_type = 'specific2'
          THEN oaw.weight ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN (oaw.is_nullified OR UPPER((v_user_answers->oaw.question_number::text)::text) = UPPER(oaw.correct_answer)) AND oaw.section_type = 'specific3'
          THEN oaw.weight ELSE 0 END), 0)
    INTO
      v_basic_score,
      v_specific1_score,
      v_specific2_score,
      v_specific3_score
    FROM
      official_answer_weights oaw
    WHERE
      oaw.concurso_id = v_concurso_id AND
      v_user_answers ? oaw.question_number::text;

    INSERT INTO score_calculation_logs (user_ranking_id, calculation_type, calculation_details)
    VALUES (p_ranking_id, 'traditional_scores', jsonb_build_object(
      'basic', v_basic_score,
      'specific1', v_specific1_score,
      'specific2', v_specific2_score,
      'specific3', v_specific3_score,
      'timestamp', NOW()
    ));

    -- Calcular pontuação total ponderada tradicional
    v_total_score :=
      (v_basic_score * COALESCE(v_concurso.basic_knowledge_weight, 1)) +
      (v_specific1_score * COALESCE(v_concurso.specific_knowledge_1_weight, 1)) +
      (v_specific2_score * COALESCE(v_concurso.specific_knowledge_2_weight, 1)) +
      (v_specific3_score * COALESCE(v_concurso.specific_knowledge_3_weight, 1)) +
      (v_discursive_score * COALESCE(v_concurso.discursive_weight, 1)) +
      (v_case_study1_score * COALESCE(v_concurso.case_study_1_weight, 1)) +
      (v_case_study2_score * COALESCE(v_concurso.case_study_2_weight, 1)) +
      (v_case_study3_score * COALESCE(v_concurso.case_study_3_weight, 1));

    v_subject_scores := jsonb_build_object(
      'basic', v_basic_score,
      'specific1', v_specific1_score,
      'specific2', v_specific2_score,
      'specific3', v_specific3_score
    );

    v_weighted_subject_scores := jsonb_build_object(
      'basic', v_basic_score * COALESCE(v_concurso.basic_knowledge_weight, 1),
      'specific1', v_specific1_score * COALESCE(v_concurso.specific_knowledge_1_weight, 1),
      'specific2', v_specific2_score * COALESCE(v_concurso.specific_knowledge_2_weight, 1),
      'specific3', v_specific3_score * COALESCE(v_concurso.specific_knowledge_3_weight, 1)
    );

    -- Atualizar ranking com pontuações tradicionais
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
      weighted_subject_scores = v_weighted_subject_scores,
      "customDisciplineScores" = '{}'::jsonb,
      "weightedCustomDisciplineScores" = '{}'::jsonb,
      is_score_recalculated = true,
      updated_at = now()
    WHERE id = p_ranking_id;

  END IF;

  INSERT INTO score_calculation_logs (user_ranking_id, calculation_type, new_score, calculation_details)
  VALUES (p_ranking_id, 'calculation_finished', v_total_score, jsonb_build_object(
    'final_score', v_total_score,
    'timestamp', now()
  ));

  RETURN v_total_score;
END;
$function$;