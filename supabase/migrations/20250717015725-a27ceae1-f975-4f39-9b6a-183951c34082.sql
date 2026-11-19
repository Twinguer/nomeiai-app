-- Debug específico para problema de persistência do caderno selecionado
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
  v_official_answers JSONB;

  -- Declarando variáveis para disciplinas customizadas
  v_block JSONB;
  v_discipline JSONB;
  v_discipline_type TEXT;
  v_discipline_weight NUMERIC;
  v_discipline_score NUMERIC;
  v_custom_discipline_scores JSONB := '{}'::jsonb;
  v_weighted_custom_discipline_scores JSONB := '{}'::jsonb;

  -- Variáveis para iterar sobre questões
  v_question_num TEXT;
  v_official_answer_data JSONB;
  v_user_answer TEXT;
  v_correct_answer TEXT;
  v_section_type TEXT;
  v_weight NUMERIC;
  v_is_nullified BOOLEAN;

BEGIN
  -- Log Inicial com timestamp detalhado
  INSERT INTO score_calculation_logs (user_ranking_id, calculation_type, calculation_details)
  VALUES (p_ranking_id, 'debug_calculation_start', jsonb_build_object(
    'message', 'DEBUG: Starting calculate_user_score_realtime', 
    'ranking_id', p_ranking_id, 
    'timestamp', NOW(),
    'function_call_context', 'realtime_calculation'
  ));

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

  -- Log dados obtidos com detalhes do caderno
  INSERT INTO score_calculation_logs (user_ranking_id, calculation_type, calculation_details)
  VALUES (p_ranking_id, 'debug_user_data_retrieved', jsonb_build_object(
    'user_id', v_user_id,
    'concurso_id', v_concurso_id,
    'selected_booklet', v_selected_booklet,
    'selected_booklet_uuid', v_selected_booklet::uuid,
    'discursive_score', v_discursive_score,
    'has_custom_knowledge', v_has_custom_knowledge,
    'timestamp', NOW()
  ));

  IF v_concurso_id IS NULL THEN
    INSERT INTO score_calculation_logs (user_ranking_id, calculation_type, calculation_details)
    VALUES (p_ranking_id, 'debug_error_no_concurso', jsonb_build_object(
      'message', 'No concurso found for ranking',
      'ranking_id', p_ranking_id,
      'timestamp', NOW()
    ));
    RETURN 0;
  END IF;

  -- Buscar dados consolidados do concurso
  SELECT consolidated_data INTO v_consolidated_data
  FROM consolidated_answers_by_concurso
  WHERE concurso_id = v_concurso_id;

  -- Log estrutura dos dados consolidados
  INSERT INTO score_calculation_logs (user_ranking_id, calculation_type, calculation_details)
  VALUES (p_ranking_id, 'debug_consolidated_data_check', jsonb_build_object(
    'consolidated_data_exists', v_consolidated_data IS NOT NULL,
    'user_exists_in_data', v_consolidated_data->'users' ? v_user_id::text,
    'user_booklets_available', 
      CASE 
        WHEN v_consolidated_data->'users' ? v_user_id::text 
        THEN jsonb_object_keys(COALESCE(v_consolidated_data->'users'->v_user_id::text->'booklets', '{}'::jsonb))
        ELSE '[]'::jsonb 
      END,
    'selected_booklet_in_data', 
      CASE 
        WHEN v_consolidated_data->'users' ? v_user_id::text 
        THEN v_consolidated_data->'users'->v_user_id::text->'booklets' ? v_selected_booklet
        ELSE false 
      END,
    'user_selected_booklet_in_consolidated', v_consolidated_data->'users'->v_user_id::text->'selected_booklet',
    'timestamp', NOW()
  ));

  IF v_consolidated_data IS NULL THEN
    INSERT INTO score_calculation_logs (user_ranking_id, calculation_type, calculation_details)
    VALUES (p_ranking_id, 'debug_error_no_consolidated_data', jsonb_build_object(
      'message', 'No consolidated data found for concurso',
      'concurso_id', v_concurso_id,
      'timestamp', NOW()
    ));
    RETURN 0;
  END IF;

  -- Extrair respostas do usuário específico do caderno selecionado
  v_user_answers := v_consolidated_data->'users'->v_user_id::text->'booklets'->v_selected_booklet->'answers';

  -- Log detalhado das respostas do usuário
  INSERT INTO score_calculation_logs (user_ranking_id, calculation_type, calculation_details)
  VALUES (p_ranking_id, 'debug_user_answers_extraction', jsonb_build_object(
    'user_answers_found', v_user_answers IS NOT NULL,
    'user_answers_keys', 
      CASE 
        WHEN v_user_answers IS NOT NULL 
        THEN jsonb_object_keys(v_user_answers) 
        ELSE '[]'::jsonb 
      END,
    'user_answers_content', v_user_answers,
    'selected_booklet_used_for_extraction', v_selected_booklet,
    'extraction_path', 'users->' || v_user_id::text || '->booklets->' || v_selected_booklet || '->answers',
    'timestamp', NOW()
  ));

  IF v_user_answers IS NULL THEN
    INSERT INTO score_calculation_logs (user_ranking_id, calculation_type, calculation_details)
    VALUES (p_ranking_id, 'debug_error_no_user_answers', jsonb_build_object(
      'message', 'No user answers found for selected booklet',
      'selected_booklet', v_selected_booklet,
      'available_booklets', jsonb_object_keys(COALESCE(v_consolidated_data->'users'->v_user_id::text->'booklets', '{}'::jsonb)),
      'timestamp', NOW()
    ));
    RETURN 0;
  END IF;

  -- Buscar gabarito oficial do CADERNO ESPECÍFICO
  SELECT consolidated_answer_data INTO v_official_answers
  FROM official_answer_weights
  WHERE concurso_id = v_concurso_id;

  -- Extrair as respostas corretas do caderno selecionado
  v_official_answers := v_official_answers->'booklets'->v_selected_booklet->'answers';

  -- Log do gabarito oficial
  INSERT INTO score_calculation_logs (user_ranking_id, calculation_type, calculation_details)
  VALUES (p_ranking_id, 'debug_official_answers_extraction', jsonb_build_object(
    'official_answers_found', v_official_answers IS NOT NULL,
    'official_answers_keys', 
      CASE 
        WHEN v_official_answers IS NOT NULL 
        THEN jsonb_object_keys(v_official_answers) 
        ELSE '[]'::jsonb 
      END,
    'official_answers_sample', v_official_answers,
    'booklet_used_for_official', v_selected_booklet,
    'timestamp', NOW()
  ));

  IF v_official_answers IS NULL THEN
    INSERT INTO score_calculation_logs (user_ranking_id, calculation_type, calculation_details)
    VALUES (p_ranking_id, 'debug_error_no_official_answers', jsonb_build_object(
      'message', 'No official answers found for selected booklet',
      'selected_booklet', v_selected_booklet,
      'timestamp', NOW()
    ));
    RETURN 0;
  END IF;

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
    VALUES (p_ranking_id, 'debug_processing_custom_knowledge', jsonb_build_object(
      'blocks_count', jsonb_array_length(v_disciplines), 
      'disciplines_structure', v_disciplines,
      'timestamp', NOW()
    ));

    -- Processar estrutura hierárquica (blocos -> disciplinas)
    FOR v_block IN SELECT * FROM jsonb_array_elements(v_disciplines)
    LOOP
      -- Verificar se é um bloco com disciplinas
      IF v_block ? 'disciplines' AND v_block->'disciplines' IS NOT NULL THEN
        
        -- Iterar pelas disciplinas dentro do bloco
        FOR v_discipline IN SELECT * FROM jsonb_array_elements(v_block->'disciplines')
        LOOP
          IF (v_discipline->>'isEnabled')::boolean IS TRUE THEN
            v_discipline_type := v_discipline->>'type';
            v_discipline_weight := COALESCE((v_discipline->>'weight')::NUMERIC, 1.0);
            v_discipline_score := 0;
            
            -- Log início da disciplina
            INSERT INTO score_calculation_logs (user_ranking_id, calculation_type, calculation_details)
            VALUES (p_ranking_id, 'debug_processing_discipline_start', jsonb_build_object(
              'discipline_name', v_discipline->>'name',
              'discipline_type', v_discipline_type,
              'discipline_weight', v_discipline_weight,
              'timestamp', NOW()
            ));
            
            -- Iterar pelas questões do gabarito oficial
            FOR v_question_num IN SELECT key FROM jsonb_object_keys(v_official_answers) AS key
            LOOP
              -- Obter dados da resposta oficial
              v_official_answer_data := v_official_answers->v_question_num;
              v_correct_answer := v_official_answer_data->>'correct_answer';
              v_section_type := v_official_answer_data->>'section_type';
              v_weight := COALESCE((v_official_answer_data->>'weight')::NUMERIC, 1.0);
              v_is_nullified := COALESCE((v_official_answer_data->>'is_nullified')::BOOLEAN, false);
              
              -- Obter resposta do usuário
              v_user_answer := v_user_answers->>v_question_num;
              
              -- Verificar se esta questão pertence à disciplina atual
              IF v_section_type = v_discipline_type AND v_user_answer IS NOT NULL THEN
                -- Log comparação questão por questão
                INSERT INTO score_calculation_logs (user_ranking_id, calculation_type, calculation_details)
                VALUES (p_ranking_id, 'debug_question_comparison', jsonb_build_object(
                  'question_num', v_question_num,
                  'discipline_type', v_discipline_type,
                  'user_answer', v_user_answer,
                  'correct_answer', v_correct_answer,
                  'is_nullified', v_is_nullified,
                  'question_weight', v_weight,
                  'answers_match', v_is_nullified OR UPPER(v_user_answer) = UPPER(v_correct_answer),
                  'section_type_matches', v_section_type = v_discipline_type,
                  'timestamp', NOW()
                ));

                -- Dar ponto se nullificada ou resposta correta
                IF v_is_nullified OR UPPER(v_user_answer) = UPPER(v_correct_answer) THEN
                  v_discipline_score := v_discipline_score + v_weight;
                END IF;
              END IF;
            END LOOP;

            -- Log resultado da disciplina
            INSERT INTO score_calculation_logs (user_ranking_id, calculation_type, calculation_details)
            VALUES (p_ranking_id, 'debug_discipline_score_final', jsonb_build_object(
              'discipline_type', v_discipline_type,
              'raw_score', v_discipline_score,
              'weight', v_discipline_weight,
              'weighted_score', v_discipline_score * v_discipline_weight,
              'timestamp', NOW()
            ));

            -- Adicionar às pontuações
            v_subject_scores := jsonb_set(v_subject_scores, ARRAY[v_discipline_type], to_jsonb(v_discipline_score), true);
            v_custom_discipline_scores := jsonb_set(v_custom_discipline_scores, ARRAY[v_discipline_type], to_jsonb(v_discipline_score), true);
            v_weighted_custom_discipline_scores := jsonb_set(v_weighted_custom_discipline_scores, ARRAY[v_discipline_type], to_jsonb(v_discipline_score * v_discipline_weight), true);

            v_total_score := v_total_score + (v_discipline_score * v_discipline_weight);
          END IF;
        END LOOP;
      ELSE
        -- Processar disciplina direta (estrutura plana - fallback)
        IF (v_block->>'isEnabled')::boolean IS TRUE THEN
          v_discipline_type := v_block->>'type';
          v_discipline_weight := COALESCE((v_block->>'weight')::NUMERIC, 1.0);
          v_discipline_score := 0;
          
          -- Iterar pelas questões do gabarito oficial
          FOR v_question_num IN SELECT key FROM jsonb_object_keys(v_official_answers) AS key
          LOOP
            -- Obter dados da resposta oficial
            v_official_answer_data := v_official_answers->v_question_num;
            v_correct_answer := v_official_answer_data->>'correct_answer';
            v_section_type := v_official_answer_data->>'section_type';
            v_weight := COALESCE((v_official_answer_data->>'weight')::NUMERIC, 1.0);
            v_is_nullified := COALESCE((v_official_answer_data->>'is_nullified')::BOOLEAN, false);
            
            -- Obter resposta do usuário
            v_user_answer := v_user_answers->>v_question_num;
            
            -- Verificar se esta questão pertence à disciplina atual
            IF v_section_type = v_discipline_type AND v_user_answer IS NOT NULL THEN
              -- Dar ponto se nullificada ou resposta correta
              IF v_is_nullified OR UPPER(v_user_answer) = UPPER(v_correct_answer) THEN
                v_discipline_score := v_discipline_score + v_weight;
              END IF;
            END IF;
          END LOOP;

          -- Adicionar às pontuações
          v_subject_scores := jsonb_set(v_subject_scores, ARRAY[v_discipline_type], to_jsonb(v_discipline_score), true);
          v_custom_discipline_scores := jsonb_set(v_custom_discipline_scores, ARRAY[v_discipline_type], to_jsonb(v_discipline_score), true);
          v_weighted_custom_discipline_scores := jsonb_set(v_weighted_custom_discipline_scores, ARRAY[v_discipline_type], to_jsonb(v_discipline_score * v_discipline_weight), true);

          v_total_score := v_total_score + (v_discipline_score * v_discipline_weight);
        END IF;
      END IF;
    END LOOP;

    -- Adicionar pontuações subjetivas
    v_total_score := v_total_score +
      (v_discursive_score * COALESCE(v_concurso.discursive_weight, 1)) +
      (v_case_study1_score * COALESCE(v_concurso.case_study_1_weight, 1)) +
      (v_case_study2_score * COALESCE(v_concurso.case_study_2_weight, 1)) +
      (v_case_study3_score * COALESCE(v_concurso.case_study_3_weight, 1));

    -- Log pontuação final
    INSERT INTO score_calculation_logs (user_ranking_id, calculation_type, calculation_details)
    VALUES (p_ranking_id, 'debug_score_calculation_complete', jsonb_build_object(
      'objective_total', v_total_score - (v_discursive_score + v_case_study1_score + v_case_study2_score + v_case_study3_score),
      'discursive_score', v_discursive_score,
      'final_total_score', v_total_score,
      'custom_discipline_scores', v_custom_discipline_scores,
      'weighted_custom_discipline_scores', v_weighted_custom_discipline_scores,
      'timestamp', NOW()
    ));

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
    -- Abordagem tradicional (não customizada) - manter código existente
    FOR v_question_num IN SELECT key FROM jsonb_object_keys(v_official_answers) AS key
    LOOP
      v_official_answer_data := v_official_answers->v_question_num;
      v_correct_answer := v_official_answer_data->>'correct_answer';
      v_section_type := v_official_answer_data->>'section_type';
      v_weight := COALESCE((v_official_answer_data->>'weight')::NUMERIC, 1.0);
      v_is_nullified := COALESCE((v_official_answer_data->>'is_nullified')::BOOLEAN, false);
      
      v_user_answer := v_user_answers->>v_question_num;
      
      IF v_user_answer IS NOT NULL THEN
        IF v_is_nullified OR UPPER(v_user_answer) = UPPER(v_correct_answer) THEN
          CASE v_section_type
            WHEN 'basic' THEN v_basic_score := v_basic_score + v_weight;
            WHEN 'specific1' THEN v_specific1_score := v_specific1_score + v_weight;
            WHEN 'specific2' THEN v_specific2_score := v_specific2_score + v_weight;
            WHEN 'specific3' THEN v_specific3_score := v_specific3_score + v_weight;
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
      (v_case_study3_score * COALESCE(v_concurso.case_study_3_weight, 1));

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
$function$;