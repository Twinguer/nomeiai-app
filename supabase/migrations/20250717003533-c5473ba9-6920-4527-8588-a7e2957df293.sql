-- Solução definitiva: usar a tabela consolidated_answers_by_concurso
-- e remover a lógica problemática da tabela user_answers

CREATE OR REPLACE FUNCTION public.save_user_answers_consolidated_by_concurso(
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