-- Corrigir a função save_user_answers_with_booklet para garantir que o ON CONFLICT funcione corretamente
-- O problema é que não há uma constraint única adequada para o ON CONFLICT

-- Primeiro, criar um índice único para user_ranking_id quando question_number é NULL
DROP INDEX IF EXISTS idx_user_answers_ranking_consolidated;
CREATE UNIQUE INDEX idx_user_answers_ranking_consolidated 
ON user_answers (user_ranking_id) 
WHERE question_number IS NULL;

-- Recriar a função save_user_answers_with_booklet com ON CONFLICT corrigido
CREATE OR REPLACE FUNCTION public.save_user_answers_with_booklet(
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
    
    -- Atualizar dados consolidados
    v_consolidated_data := jsonb_set(
        v_existing_data,
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
    ELSE
        -- Inserir novo registro
        INSERT INTO user_answers (user_ranking_id, answers_data, answer_format, updated_at)
        VALUES (p_ranking_id, v_consolidated_data, 'CONSOLIDATED', now());
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
    
    -- Log sucesso
    INSERT INTO score_calculation_logs (user_ranking_id, calculation_type, calculation_details)
    VALUES (p_ranking_id, 'save_answers_success', jsonb_build_object(
        'success', true,
        'edit_count', p_current_edit_count + 1,
        'answers_saved', v_answers_saved,
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