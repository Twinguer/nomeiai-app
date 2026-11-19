-- Fix remaining database functions with missing search_path

-- Fix all existing functions that need search_path
CREATE OR REPLACE FUNCTION public.save_user_answers_with_booklet(p_ranking_id uuid, p_concurso_id uuid, p_booklet_id text, p_answers jsonb, p_discursive_score numeric DEFAULT 0, p_case_study_1_score numeric DEFAULT 0, p_case_study_2_score numeric DEFAULT 0, p_case_study_3_score numeric DEFAULT 0, p_current_edit_count integer DEFAULT 0)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
    v_existing_data JSONB;
    v_consolidated_data JSONB;
    v_booklet_answers JSONB := '{}';
    v_answer RECORD;
    v_answers_saved INTEGER := 0;
    v_existing_record_id INTEGER;
BEGIN
    -- Log início da operação
    INSERT INTO score_calculation_logs (user_ranking_id, calculation_type, calculation_details)
    VALUES (p_ranking_id, 'save_answers_start', jsonb_build_object(
        'booklet_id', p_booklet_id,
        'answers_count', jsonb_array_length(p_answers),
        'current_edit_count', p_current_edit_count,
        'timestamp', now()
    ));

    -- Verificar limite de edições
    IF p_current_edit_count >= 5 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Limite de edições atingido');
    END IF;
    
    -- Buscar dados consolidados existentes
    SELECT id, answers_data INTO v_existing_record_id, v_existing_data
    FROM user_answers
    WHERE user_ranking_id = p_ranking_id
    AND question_number IS NULL;
    
    -- Log dados existentes
    INSERT INTO score_calculation_logs (user_ranking_id, calculation_type, calculation_details)
    VALUES (p_ranking_id, 'existing_data_check', jsonb_build_object(
        'existing_record_found', v_existing_record_id IS NOT NULL,
        'existing_data', v_existing_data,
        'timestamp', now()
    ));
    
    -- Se não existir, criar estrutura base
    IF v_existing_data IS NULL THEN
        v_existing_data := jsonb_build_object(
            'booklets', '{}',
            'subjective_scores', jsonb_build_object(
                'discursive', 0,
                'case_study_1', 0,
                'case_study_2', 0,
                'case_study_3', 0
            ),
            'selected_booklet', '',
            'total_edit_count', 0,
            'metadata', jsonb_build_object(
                'last_updated', now(),
                'version', '2.0'
            )
        );
    END IF;
    
    -- Processar respostas do array p_answers
    FOR v_answer IN
        SELECT 
            (elem->>'questionNumber')::integer as question_number,
            elem->>'answer' as answer
        FROM jsonb_array_elements(p_answers) as elem
        WHERE elem->>'questionNumber' IS NOT NULL AND elem->>'answer' IS NOT NULL
    LOOP
        v_booklet_answers := jsonb_set(
            v_booklet_answers,
            ARRAY[v_answer.question_number::text],
            to_jsonb(v_answer.answer)
        );
        v_answers_saved := v_answers_saved + 1;
    END LOOP;
    
    -- Log respostas processadas
    INSERT INTO score_calculation_logs (user_ranking_id, calculation_type, calculation_details)
    VALUES (p_ranking_id, 'answers_processed', jsonb_build_object(
        'booklet_answers', v_booklet_answers,
        'answers_saved_count', v_answers_saved,
        'timestamp', now()
    ));
    
    -- CORREÇÃO: Usar v_existing_data como base e adicionar o booklet específico
    v_consolidated_data := v_existing_data;
    
    -- Garantir que booklets existe na estrutura
    IF v_consolidated_data->'booklets' IS NULL THEN
        v_consolidated_data := jsonb_set(v_consolidated_data, ARRAY['booklets'], '{}');
    END IF;
    
    -- Atualizar dados do booklet específico DENTRO da estrutura booklets
    v_consolidated_data := jsonb_set(
        v_consolidated_data,
        ARRAY['booklets', p_booklet_id],
        jsonb_build_object(
            'answers', v_booklet_answers,
            'metadata', jsonb_build_object(
                'completed_at', now(),
                'answer_count', v_answers_saved
            )
        )
    );
    
    -- Atualizar scores subjetivos
    v_consolidated_data := jsonb_set(v_consolidated_data, ARRAY['subjective_scores'], 
        jsonb_build_object(
            'discursive', p_discursive_score,
            'case_study_1', p_case_study_1_score,
            'case_study_2', p_case_study_2_score,
            'case_study_3', p_case_study_3_score
        )
    );
    
    -- Atualizar metadados
    v_consolidated_data := jsonb_set(v_consolidated_data, ARRAY['selected_booklet'], to_jsonb(p_booklet_id));
    v_consolidated_data := jsonb_set(v_consolidated_data, ARRAY['total_edit_count'], to_jsonb(p_current_edit_count + 1));
    v_consolidated_data := jsonb_set(v_consolidated_data, ARRAY['metadata', 'last_updated'], to_jsonb(now()));
    
    -- Log dados finais antes de salvar
    INSERT INTO score_calculation_logs (user_ranking_id, calculation_type, calculation_details)
    VALUES (p_ranking_id, 'final_data_before_save', jsonb_build_object(
        'consolidated_data', v_consolidated_data,
        'timestamp', now()
    ));
    
    -- Salvar dados consolidados usando UPSERT baseado no índice único
    IF v_existing_record_id IS NOT NULL THEN
        -- Atualizar registro existente
        UPDATE user_answers 
        SET 
            answers_data = v_consolidated_data,
            answer_format = 'CONSOLIDATED',
            updated_at = now()
        WHERE id = v_existing_record_id;
        
        INSERT INTO score_calculation_logs (user_ranking_id, calculation_type, calculation_details)
        VALUES (p_ranking_id, 'updated_existing_record', jsonb_build_object(
            'record_id', v_existing_record_id,
            'timestamp', now()
        ));
    ELSE
        -- Inserir novo registro
        INSERT INTO user_answers (user_ranking_id, answers_data, answer_format, updated_at)
        VALUES (p_ranking_id, v_consolidated_data, 'CONSOLIDATED', now())
        RETURNING id INTO v_existing_record_id;
        
        INSERT INTO score_calculation_logs (user_ranking_id, calculation_type, calculation_details)
        VALUES (p_ranking_id, 'inserted_new_record', jsonb_build_object(
            'record_id', v_existing_record_id,
            'timestamp', now()
        ));
    END IF;
    
    -- Atualizar user_rankings
    UPDATE user_rankings
    SET 
        edit_count = p_current_edit_count + 1,
        discursive_score = p_discursive_score,
        case_study_1_score = p_case_study_1_score,
        case_study_2_score = p_case_study_2_score,
        case_study_3_score = p_case_study_3_score,
        selected_booklet = CASE 
            WHEN p_booklet_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' 
            THEN p_booklet_id::uuid 
            ELSE NULL 
        END,
        updated_at = now()
    WHERE id = p_ranking_id;
    
    -- Recalcular pontuação após salvar respostas
    PERFORM calculate_user_score_realtime(p_ranking_id);
    
    -- Log sucesso
    INSERT INTO score_calculation_logs (user_ranking_id, calculation_type, calculation_details)
    VALUES (p_ranking_id, 'save_answers_success', jsonb_build_object(
        'success', true,
        'edit_count', p_current_edit_count + 1,
        'answers_saved', v_answers_saved,
        'final_booklets_structure', v_consolidated_data->'booklets',
        'timestamp', now()
    ));
    
    RETURN jsonb_build_object(
        'success', true, 
        'edit_count', p_current_edit_count + 1,
        'answers_saved', v_answers_saved,
        'saved_answers', v_booklet_answers
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.restructure_user_answers_by_concurso()
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE
    v_concurso_id UUID;
    v_consolidated_data JSONB := '{}';
    v_user_data RECORD;
BEGIN
    -- Processar cada concurso
    FOR v_concurso_id IN 
        SELECT DISTINCT ur.concurso_id 
        FROM user_rankings ur 
        JOIN user_answers ua ON ua.user_ranking_id = ur.id
        WHERE ua.question_number IS NULL
    LOOP
        -- Reset para cada concurso
        v_consolidated_data := jsonb_build_object(
            'concurso_id', v_concurso_id,
            'users', '{}',
            'metadata', jsonb_build_object(
                'last_updated', now(),
                'version', '3.0',
                'total_users', 0
            )
        );
        
        -- Coletar dados de todos os usuários deste concurso
        FOR v_user_data IN
            SELECT 
                ur.id as ranking_id,
                ur.user_id,
                up.name as user_name,
                ua.answers_data,
                ur.selected_booklet,
                ur.discursive_score,
                ur.case_study_1_score,
                ur.case_study_2_score,
                ur.case_study_3_score,
                ur.edit_count
            FROM user_rankings ur
            LEFT JOIN users_profiles up ON up.id = ur.user_id
            LEFT JOIN user_answers ua ON ua.user_ranking_id = ur.id AND ua.question_number IS NULL
            WHERE ur.concurso_id = v_concurso_id
        LOOP
            -- Adicionar usuário ao JSON consolidado
            v_consolidated_data := jsonb_set(
                v_consolidated_data,
                ARRAY['users', v_user_data.user_id::text],
                jsonb_build_object(
                    'ranking_id', v_user_data.ranking_id,
                    'user_name', COALESCE(v_user_data.user_name, 'Usuário'),
                    'booklets', COALESCE(v_user_data.answers_data->'booklets', '{}'),
                    'subjective_scores', jsonb_build_object(
                        'discursive', COALESCE(v_user_data.discursive_score, 0),
                        'case_study_1', COALESCE(v_user_data.case_study_1_score, 0),
                        'case_study_2', COALESCE(v_user_data.case_study_2_score, 0),
                        'case_study_3', COALESCE(v_user_data.case_study_3_score, 0)
                    ),
                    'selected_booklet', COALESCE(v_user_data.selected_booklet::text, ''),
                    'edit_count', COALESCE(v_user_data.edit_count, 0),
                    'last_updated', now()
                )
            );
        END LOOP;
        
        -- Atualizar metadata com contagem de usuários
        v_consolidated_data := jsonb_set(
            v_consolidated_data,
            ARRAY['metadata', 'total_users'],
            to_jsonb(jsonb_object_keys(v_consolidated_data->'users'))
        );
        
        -- Deletar registros antigos deste concurso
        DELETE FROM user_answers 
        WHERE user_ranking_id IN (
            SELECT id FROM user_rankings WHERE concurso_id = v_concurso_id
        );
        
        -- Inserir novo registro consolidado por concurso
        INSERT INTO user_answers (
            user_ranking_id, 
            answers_data, 
            answer_format, 
            updated_at
        ) VALUES (
            v_concurso_id, -- Usar concurso_id como identificador
            v_consolidated_data,
            'CONSOLIDATED_BY_CONCURSO',
            now()
        );
        
        RAISE NOTICE 'Concurso % reestruturado com % usuários', 
            v_concurso_id, 
            jsonb_array_length(jsonb_object_keys(v_consolidated_data->'users'));
            
    END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.save_user_answers_consolidated_by_concurso(p_ranking_id uuid, p_concurso_id uuid, p_booklet_id text, p_answers jsonb, p_discursive_score numeric DEFAULT 0, p_case_study_1_score numeric DEFAULT 0, p_case_study_2_score numeric DEFAULT 0, p_case_study_3_score numeric DEFAULT 0, p_current_edit_count integer DEFAULT 0)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
    v_user_id UUID;
    v_user_name TEXT;
    v_existing_data JSONB;
    v_booklet_answers JSONB := '{}';
    v_answer RECORD;
    v_answers_saved INTEGER := 0;
    v_total_users INTEGER;
BEGIN
    -- Verificar limite de edições
    IF p_current_edit_count >= 5 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Limite de edições atingido');
    END IF;
    
    -- Obter informações do usuário
    SELECT ur.user_id, up.name 
    INTO v_user_id, v_user_name
    FROM user_rankings ur
    LEFT JOIN users_profiles up ON up.id = ur.user_id
    WHERE ur.id = p_ranking_id;
    
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Ranking não encontrado');
    END IF;
    
    -- Buscar dados consolidados do CONCURSO na tabela dedicada
    SELECT consolidated_data INTO v_existing_data
    FROM consolidated_answers_by_concurso
    WHERE concurso_id = p_concurso_id;
    
    -- Se não existir, criar estrutura base do concurso
    IF v_existing_data IS NULL THEN
        v_existing_data := jsonb_build_object(
            'concurso_id', p_concurso_id,
            'users', '{}',
            'metadata', jsonb_build_object(
                'last_updated', now(),
                'version', '3.0',
                'total_users', 0
            )
        );
    END IF;
    
    -- Garantir que users seja sempre um objeto JSON
    IF v_existing_data->'users' IS NULL OR jsonb_typeof(v_existing_data->'users') = 'string' THEN
        v_existing_data := jsonb_set(v_existing_data, ARRAY['users'], '{}');
    END IF;
    
    -- Processar respostas objetivas usando jsonb_each
    FOR v_answer IN
        SELECT 
            key::integer as question_number,
            value::text as answer
        FROM jsonb_each_text(p_answers)
        WHERE key ~ '^[0-9]+$' AND value IS NOT NULL AND value != ''
    LOOP
        v_booklet_answers := jsonb_set(
            v_booklet_answers,
            ARRAY[v_answer.question_number::text],
            to_jsonb(v_answer.answer)
        );
        v_answers_saved := v_answers_saved + 1;
    END LOOP;
    
    -- Atualizar dados do usuário específico no JSON consolidado do concurso
    v_existing_data := jsonb_set(
        v_existing_data,
        ARRAY['users', v_user_id::text],
        jsonb_build_object(
            'ranking_id', p_ranking_id,
            'user_name', COALESCE(v_user_name, 'Usuário'),
            'booklets', jsonb_build_object(
                p_booklet_id, jsonb_build_object(
                    'answers', v_booklet_answers,
                    'metadata', jsonb_build_object(
                        'completed_at', now(),
                        'answer_count', v_answers_saved
                    )
                )
            ),
            'subjective_scores', jsonb_build_object(
                'discursive', p_discursive_score,
                'case_study_1', p_case_study_1_score,
                'case_study_2', p_case_study_2_score,
                'case_study_3', p_case_study_3_score
            ),
            'selected_booklet', p_booklet_id,
            'edit_count', p_current_edit_count + 1,
            'last_updated', now()
        )
    );
    
    -- Calcular total de usuários corretamente
    SELECT COUNT(*) INTO v_total_users
    FROM jsonb_object_keys(v_existing_data->'users') AS user_key;
    
    -- Atualizar metadados
    v_existing_data := jsonb_set(v_existing_data, ARRAY['metadata', 'last_updated'], to_jsonb(now()));
    v_existing_data := jsonb_set(v_existing_data, ARRAY['metadata', 'total_users'], to_jsonb(v_total_users));
    
    -- Salvar dados consolidados por concurso na tabela correta
    INSERT INTO consolidated_answers_by_concurso (concurso_id, consolidated_data, updated_at)
    VALUES (p_concurso_id, v_existing_data, now())
    ON CONFLICT (concurso_id)
    DO UPDATE SET
        consolidated_data = EXCLUDED.consolidated_data,
        updated_at = EXCLUDED.updated_at;
    
    -- Atualizar user_rankings individual
    UPDATE user_rankings
    SET 
        edit_count = p_current_edit_count + 1,
        discursive_score = p_discursive_score,
        case_study_1_score = p_case_study_1_score,
        case_study_2_score = p_case_study_2_score,
        case_study_3_score = p_case_study_3_score,
        selected_booklet = CASE 
            WHEN p_booklet_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' 
            THEN p_booklet_id::uuid 
            ELSE NULL 
        END,
        updated_at = now()
    WHERE id = p_ranking_id;
    
    -- Recalcular pontuação
    PERFORM calculate_user_score_realtime(p_ranking_id);
    
    RETURN jsonb_build_object(
        'success', true, 
        'edit_count', p_current_edit_count + 1,
        'answers_saved', v_answers_saved,
        'saved_answers', v_booklet_answers
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.switch_user_booklet(p_ranking_id uuid, p_booklet_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
    v_user_id UUID;
    v_concurso_id UUID;
    v_consolidated_data JSONB;
    v_booklet_answers JSONB;
    v_previous_booklet TEXT;
BEGIN
    -- Log início
    INSERT INTO score_calculation_logs (user_ranking_id, calculation_type, calculation_details)
    VALUES (p_ranking_id, 'switch_booklet_start', jsonb_build_object(
        'new_booklet_id', p_booklet_id,
        'timestamp', now()
    ));

    -- Obter informações do usuário e concurso  
    SELECT user_id, concurso_id, selected_booklet INTO v_user_id, v_concurso_id, v_previous_booklet
    FROM user_rankings
    WHERE id = p_ranking_id;
    
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Ranking não encontrado');
    END IF;
    
    -- Log dados do usuário
    INSERT INTO score_calculation_logs (user_ranking_id, calculation_type, calculation_details)
    VALUES (p_ranking_id, 'switch_booklet_user_data', jsonb_build_object(
        'user_id', v_user_id,
        'concurso_id', v_concurso_id,
        'previous_booklet', v_previous_booklet,
        'new_booklet', p_booklet_id,
        'timestamp', now()
    ));
    
    -- Buscar dados consolidados do concurso
    SELECT consolidated_data INTO v_consolidated_data
    FROM consolidated_answers_by_concurso
    WHERE concurso_id = v_concurso_id;
    
    IF v_consolidated_data IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Dados do concurso não encontrados');
    END IF;
    
    -- Log dados encontrados
    INSERT INTO score_calculation_logs (user_ranking_id, calculation_type, calculation_details)
    VALUES (p_ranking_id, 'switch_booklet_data_found', jsonb_build_object(
        'consolidated_data_exists', v_consolidated_data IS NOT NULL,
        'user_in_data', v_consolidated_data->'users' ? v_user_id::text,
        'available_booklets', jsonb_object_keys(COALESCE(v_consolidated_data->'users'->v_user_id::text->'booklets', '{}'::jsonb)),
        'timestamp', now()
    ));
    
    -- Atualizar o caderno selecionado do usuário específico
    v_consolidated_data := jsonb_set(
        v_consolidated_data,
        ARRAY['users', v_user_id::text, 'selected_booklet'],
        to_jsonb(p_booklet_id)
    );
    
    -- Atualizar timestamp
    v_consolidated_data := jsonb_set(
        v_consolidated_data,
        ARRAY['users', v_user_id::text, 'last_updated'],
        to_jsonb(now())
    );
    
    -- Salvar dados consolidados atualizados
    UPDATE consolidated_answers_by_concurso
    SET 
        consolidated_data = v_consolidated_data,
        updated_at = now()
    WHERE concurso_id = v_concurso_id;
    
    -- Atualizar selected_booklet no user_rankings
    UPDATE user_rankings
    SET 
        selected_booklet = CASE 
            WHEN p_booklet_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' 
            THEN p_booklet_id::uuid 
            ELSE NULL 
        END,
        updated_at = now()
    WHERE id = p_ranking_id;
    
    -- Buscar respostas do caderno específico do usuário
    v_booklet_answers := v_consolidated_data->'users'->v_user_id::text->'booklets'->p_booklet_id->'answers';
    
    -- Log resultado final
    INSERT INTO score_calculation_logs (user_ranking_id, calculation_type, calculation_details)
    VALUES (p_ranking_id, 'switch_booklet_result', jsonb_build_object(
        'success', true,
        'booklet_changed_from', v_previous_booklet,
        'booklet_changed_to', p_booklet_id,
        'answers_found', v_booklet_answers IS NOT NULL,
        'answers_count', CASE 
            WHEN v_booklet_answers IS NOT NULL 
            THEN jsonb_object_keys(v_booklet_answers) 
            ELSE '[]'::jsonb 
        END,
        'timestamp', now()
    ));
    
    -- Recalcular pontuação após mudança de caderno
    PERFORM calculate_user_score_realtime(p_ranking_id);
    
    RETURN jsonb_build_object(
        'success', true,
        'booklet_id', p_booklet_id,
        'answers', COALESCE(v_booklet_answers, '{}'::jsonb),
        'message', 'Caderno alterado com sucesso'
    );
END;
$function$;