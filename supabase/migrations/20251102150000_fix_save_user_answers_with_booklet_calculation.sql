-- ============================================================================
-- CORREÇÃO: Atualizar save_user_answers_with_booklet para chamar 
-- calculate_user_score_realtime com a assinatura correta
-- ============================================================================
-- PROBLEMA:
--   A função save_user_answers_with_booklet chama calculate_user_score_realtime(p_ranking_id)
--   mas a função agora requer 4 parâmetros: (text, uuid, uuid, text)
-- 
-- SOLUÇÃO:
--   Buscar ranking_id (text), user_id, concurso_id e selected_booklet_id 
--   do consolidated_data e chamar calculate_user_score_realtime corretamente
-- ============================================================================

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
SET search_path TO 'public'
AS $function$
DECLARE
    v_user_id UUID;
    v_existing_data JSONB;
    v_consolidated_data JSONB;
    v_booklet_answers JSONB := '{}';
    v_answer RECORD;
    v_answers_saved INTEGER := 0;
    v_existing_record_id INTEGER;
    v_max_edits INTEGER;
    -- Variáveis para chamar calculate_user_score_realtime
    v_ranking_key TEXT;
    v_selected_booklet_id TEXT;
BEGIN
    -- SECURITY: Verify user owns this ranking
    SELECT user_id INTO v_user_id
    FROM user_rankings
    WHERE id = p_ranking_id;
    
    IF v_user_id IS NULL OR v_user_id != auth.uid() THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized access');
    END IF;

    -- Log security check
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'security_logs') THEN
        INSERT INTO security_logs (user_id, action, details)
        VALUES (auth.uid(), 'save_answers_attempt', jsonb_build_object(
            'ranking_id', p_ranking_id,
            'authorized', true
        ));
    END IF;

    -- Obter limite de edições baseado no plano do usuário
    v_max_edits := get_user_edit_limit(v_user_id);
    
    -- Verificar limite
    IF p_current_edit_count >= v_max_edits THEN
        RETURN jsonb_build_object(
            'success', false, 
            'error', format('Limite de %s edição(ões) atingido', v_max_edits)
        );
    END IF;
    
    SELECT id, answers_data INTO v_existing_record_id, v_existing_data
    FROM user_answers
    WHERE user_ranking_id = p_ranking_id
    AND question_number IS NULL;
    
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
    
    v_consolidated_data := v_existing_data;
    
    IF v_consolidated_data->'booklets' IS NULL THEN
        v_consolidated_data := jsonb_set(v_consolidated_data, ARRAY['booklets'], '{}');
    END IF;
    
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
    
    v_consolidated_data := jsonb_set(v_consolidated_data, ARRAY['subjective_scores'], 
        jsonb_build_object(
            'discursive', p_discursive_score,
            'case_study_1', p_case_study_1_score,
            'case_study_2', p_case_study_2_score,
            'case_study_3', p_case_study_3_score
        )
    );
    
    v_consolidated_data := jsonb_set(v_consolidated_data, ARRAY['selected_booklet'], to_jsonb(p_booklet_id));
    v_consolidated_data := jsonb_set(v_consolidated_data, ARRAY['total_edit_count'], to_jsonb(p_current_edit_count + 1));
    v_consolidated_data := jsonb_set(v_consolidated_data, ARRAY['metadata', 'last_updated'], to_jsonb(now()));
    
    IF v_existing_record_id IS NOT NULL THEN
        UPDATE user_answers 
        SET 
            answers_data = v_consolidated_data,
            answer_format = 'CONSOLIDATED',
            updated_at = now()
        WHERE id = v_existing_record_id;
    ELSE
        INSERT INTO user_answers (user_ranking_id, answers_data, answer_format, updated_at)
        VALUES (p_ranking_id, v_consolidated_data, 'CONSOLIDATED', now())
        RETURNING id INTO v_existing_record_id;
    END IF;
    
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
    
    -- ✅ CORREÇÃO: Buscar dados do consolidated_data para chamar calculate_user_score_realtime corretamente
    SELECT consolidated_data INTO v_consolidated_data
    FROM user_rankings
    WHERE id = p_ranking_id;
    
    -- Buscar o ranking_key e selected_booklet_id do consolidated_data
    IF v_consolidated_data IS NOT NULL AND v_consolidated_data ? 'rankings' THEN
        FOR v_ranking_key IN
            SELECT key
            FROM jsonb_object_keys(v_consolidated_data->'rankings') AS key
        LOOP
            IF (v_consolidated_data->'rankings'->v_ranking_key->>'concurso_id')::uuid = p_concurso_id THEN
                v_selected_booklet_id := COALESCE(
                    v_consolidated_data->'rankings'->v_ranking_key->>'selected_booklet_id',
                    v_consolidated_data->'rankings'->v_ranking_key->'user_data'->>'selected_booklet_id',
                    p_booklet_id
                );
                
                -- ✅ Chamar calculate_user_score_realtime com a assinatura correta
                PERFORM calculate_user_score_realtime(
                    v_ranking_key,           -- p_ranking_id (text)
                    v_user_id,               -- p_user_id (uuid)
                    p_concurso_id,           -- p_concurso_id (uuid)
                    v_selected_booklet_id    -- p_selected_booklet (text)
                );
                
                EXIT;
            END IF;
        END LOOP;
    END IF;
    
    RETURN jsonb_build_object(
        'success', true, 
        'edit_count', p_current_edit_count + 1,
        'answers_saved', v_answers_saved,
        'saved_answers', v_booklet_answers
    );
END;
$function$;

COMMENT ON FUNCTION public.save_user_answers_with_booklet IS 'Função atualizada para chamar calculate_user_score_realtime com a assinatura correta (4 parâmetros)';

