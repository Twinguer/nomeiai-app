
-- Remover funções existentes primeiro
DROP FUNCTION IF EXISTS public.update_answer_with_weight(uuid,integer,text,numeric,boolean,text);
DROP FUNCTION IF EXISTS public.save_user_answers_with_booklet(uuid,uuid,text,jsonb,numeric,numeric,numeric,numeric,integer);

-- Recriar função RPC para salvar gabarito usando estrutura consolidada
CREATE OR REPLACE FUNCTION public.update_answer_with_weight(
  p_concurso_id uuid,
  p_question_number integer,
  p_correct_answer text,
  p_weight numeric DEFAULT 1.0,
  p_is_nullified boolean DEFAULT false,
  p_section_type text DEFAULT 'basic'
)
RETURNS jsonb
LANGUAGE plpgsql
AS $function$
DECLARE
    v_existing_data jsonb;
    v_consolidated_data jsonb;
    v_booklet_key text := 'default';
    v_question_key text;
BEGIN
    v_question_key := p_question_number::text;
    
    -- Buscar dados existentes
    SELECT consolidated_answer_data INTO v_existing_data
    FROM official_answer_weights
    WHERE concurso_id = p_concurso_id;
    
    -- Se não existir, criar estrutura base
    IF v_existing_data IS NULL THEN
        v_existing_data := jsonb_build_object(
            'booklets', jsonb_build_object(
                v_booklet_key, jsonb_build_object(
                    'answers', '{}',
                    'metadata', jsonb_build_object(
                        'total_questions', 0,
                        'created_at', now()
                    )
                )
            ),
            'metadata', jsonb_build_object(
                'version', '1.0',
                'created_at', now()
            )
        );
    END IF;
    
    -- Garantir que a estrutura de cadernos existe
    IF NOT (v_existing_data ? 'booklets') THEN
        v_existing_data := jsonb_set(v_existing_data, ARRAY['booklets'], '{}'::jsonb);
    END IF;
    
    -- Garantir que o caderno default existe
    IF NOT (v_existing_data->'booklets' ? v_booklet_key) THEN
        v_existing_data := jsonb_set(
            v_existing_data,
            ARRAY['booklets', v_booklet_key],
            jsonb_build_object(
                'answers', '{}',
                'metadata', jsonb_build_object(
                    'total_questions', 0,
                    'created_at', now()
                )
            )
        );
    END IF;
    
    -- Atualizar a resposta específica
    v_consolidated_data := jsonb_set(
        v_existing_data,
        ARRAY['booklets', v_booklet_key, 'answers', v_question_key],
        jsonb_build_object(
            'correct_answer', p_correct_answer,
            'weight', p_weight,
            'section_type', p_section_type,
            'is_nullified', p_is_nullified,
            'answer_format', 'OBJECTIVE',
            'question_type', 'MULTIPLE_CHOICE'
        )
    );
    
    -- Atualizar metadados
    v_consolidated_data := jsonb_set(
        v_consolidated_data,
        ARRAY['metadata', 'last_updated'],
        to_jsonb(now())
    );
    
    -- Inserir ou atualizar
    INSERT INTO official_answer_weights (
        concurso_id,
        consolidated_answer_data,
        created_at,
        updated_at
    ) VALUES (
        p_concurso_id,
        v_consolidated_data,
        now(),
        now()
    )
    ON CONFLICT (concurso_id)
    DO UPDATE SET 
        consolidated_answer_data = EXCLUDED.consolidated_answer_data,
        updated_at = now();
    
    RETURN jsonb_build_object(
        'success', true,
        'question_number', p_question_number,
        'answer_updated', true
    );
END;
$function$;

-- Recriar função save_user_answers_with_booklet para trabalhar com a nova estrutura
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
BEGIN
    -- Verificar limite de edições
    IF p_current_edit_count >= 5 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Limite de edições atingido');
    END IF;
    
    -- Buscar dados consolidados existentes
    SELECT answers_data INTO v_existing_data
    FROM user_answers
    WHERE user_ranking_id = p_ranking_id
    AND question_number IS NULL;
    
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
    LOOP
        v_booklet_answers := jsonb_set(
            v_booklet_answers,
            ARRAY[v_answer.question_number::text],
            to_jsonb(v_answer.answer)
        );
        v_answers_saved := v_answers_saved + 1;
    END LOOP;
    
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
    
    -- Salvar dados consolidados
    INSERT INTO user_answers (user_ranking_id, answers_data, answer_format, updated_at)
    VALUES (p_ranking_id, v_consolidated_data, 'CONSOLIDATED', now())
    ON CONFLICT (user_ranking_id) WHERE question_number IS NULL
    DO UPDATE SET 
        answers_data = EXCLUDED.answers_data,
        answer_format = 'CONSOLIDATED',
        updated_at = now();
    
    -- Atualizar user_rankings
    UPDATE user_rankings
    SET 
        edit_count = p_current_edit_count + 1,
        discursive_score = p_discursive_score,
        case_study_1_score = p_case_study_1_score,
        case_study_2_score = p_case_study_2_score,
        case_study_3_score = p_case_study_3_score,
        selected_booklet = p_booklet_id::uuid,
        updated_at = now()
    WHERE id = p_ranking_id;
    
    RETURN jsonb_build_object(
        'success', true, 
        'edit_count', p_current_edit_count + 1,
        'answers_saved', v_answers_saved,
        'saved_answers', v_booklet_answers
    );
END;
$function$;
