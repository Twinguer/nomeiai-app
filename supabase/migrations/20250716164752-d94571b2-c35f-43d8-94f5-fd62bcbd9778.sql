-- Reestruturação da tabela user_answers para ter um registro por concurso
-- com todos os usuários organizados no JSON answers_data

-- 1. Criar nova estrutura consolidada
CREATE OR REPLACE FUNCTION restructure_user_answers_by_concurso()
RETURNS void
LANGUAGE plpgsql
AS $$
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
$$;

-- 2. Executar a reestruturação
SELECT restructure_user_answers_by_concurso();

-- 3. Nova função para salvar respostas na estrutura consolidada por concurso
CREATE OR REPLACE FUNCTION save_user_answers_consolidated_by_concurso(
    p_ranking_id uuid,
    p_concurso_id uuid,
    p_booklet_id text,
    p_answers jsonb,
    p_discursive_score numeric DEFAULT 0,
    p_case_study_1_score numeric DEFAULT 0,
    p_case_study_2_score numeric DEFAULT 0,
    p_case_study_3_score numeric DEFAULT 0,
    p_current_edit_count integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_user_name TEXT;
    v_existing_data JSONB;
    v_booklet_answers JSONB := '{}';
    v_answer RECORD;
    v_answers_saved INTEGER := 0;
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
    
    -- Buscar dados consolidados do concurso
    SELECT answers_data INTO v_existing_data
    FROM user_answers
    WHERE user_ranking_id = p_concurso_id;
    
    -- Se não existir, criar estrutura base
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
    
    -- Processar respostas objetivas
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
    
    -- Atualizar/criar dados do usuário no JSON consolidado
    v_existing_data := jsonb_set(
        v_existing_data,
        ARRAY['users', v_user_id::text],
        jsonb_build_object(
            'ranking_id', p_ranking_id,
            'user_name', COALESCE(v_user_name, 'Usuário'),
            'booklets', jsonb_set(
                COALESCE(v_existing_data->'users'->v_user_id::text->'booklets', '{}'),
                ARRAY[p_booklet_id],
                jsonb_build_object(
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
    
    -- Atualizar metadata
    v_existing_data := jsonb_set(
        v_existing_data,
        ARRAY['metadata', 'last_updated'],
        to_jsonb(now())
    );
    
    v_existing_data := jsonb_set(
        v_existing_data,
        ARRAY['metadata', 'total_users'],
        to_jsonb(jsonb_object_keys(v_existing_data->'users'))
    );
    
    -- Salvar dados consolidados
    INSERT INTO user_answers (user_ranking_id, answers_data, answer_format, updated_at)
    VALUES (p_concurso_id, v_existing_data, 'CONSOLIDATED_BY_CONCURSO', now())
    ON CONFLICT (user_ranking_id, COALESCE(question_number, -1))
    DO UPDATE SET
        answers_data = EXCLUDED.answers_data,
        updated_at = EXCLUDED.updated_at;
    
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
    
    -- Recalcular pontuação
    PERFORM calculate_user_score_realtime(p_ranking_id);
    
    RETURN jsonb_build_object(
        'success', true, 
        'edit_count', p_current_edit_count + 1,
        'answers_saved', v_answers_saved,
        'user_id', v_user_id
    );
END;
$$;