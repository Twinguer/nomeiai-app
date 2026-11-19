
-- Corrigir função save_consolidated_answer_key para usar 'answers' ao invés de 'questions'
-- Isso alinha o backend com o frontend (tipo ConsolidatedAnswerKey)

CREATE OR REPLACE FUNCTION public.save_consolidated_answer_key(
    p_concurso_id uuid, 
    p_booklet_id text, 
    p_answers jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_existing_data JSONB;
    v_consolidated_data JSONB;
    v_booklet_answers JSONB := '{}';
    v_question_key TEXT;
    v_answer_data JSONB;
    v_answer_count INTEGER := 0;
    v_recalc_result JSONB;
BEGIN
    RAISE NOTICE 'Starting save_consolidated_answer_key for concurso % booklet %', p_concurso_id, p_booklet_id;
    
    -- Buscar dados existentes do campo official_answers da tabela concursos
    SELECT COALESCE(official_answers, '{}'::jsonb)
    INTO v_existing_data
    FROM concursos
    WHERE id = p_concurso_id;
    
    -- Se não encontrar o concurso, retornar erro
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Concurso % not found', p_concurso_id;
    END IF;
    
    RAISE NOTICE 'Processing % answers for booklet %', jsonb_typeof(p_answers), p_booklet_id;
    
    -- Construir objeto de respostas do caderno
    FOR v_question_key, v_answer_data IN SELECT * FROM jsonb_each(p_answers)
    LOOP
        v_booklet_answers := jsonb_set(
            v_booklet_answers,
            ARRAY[v_question_key],
            v_answer_data
        );
        v_answer_count := v_answer_count + 1;
    END LOOP;
    
    RAISE NOTICE 'Processed % answers for booklet %', v_answer_count, p_booklet_id;
    
    -- ✅ CORREÇÃO: Usar 'answers' ao invés de 'questions' para alinhar com frontend
    v_consolidated_data := jsonb_set(
        v_existing_data,
        ARRAY[p_booklet_id],
        jsonb_build_object(
            'answers', v_booklet_answers,  -- ✅ MUDADO DE 'questions' PARA 'answers'
            'metadata', jsonb_build_object(
                'answer_count', v_answer_count,  -- ✅ MUDADO DE 'total_questions' PARA 'answer_count'
                'last_updated', now(),
                'booklet_name', p_booklet_id
            )
        )
    );
    
    -- Atualizar o campo official_answers na tabela concursos
    UPDATE concursos 
    SET 
        official_answers = v_consolidated_data,
        updated_at = now()
    WHERE id = p_concurso_id;
    
    RAISE NOTICE 'Successfully saved consolidated answer key for concurso % booklet %', p_concurso_id, p_booklet_id;
    
    -- ✅ RECÁLCULO AUTOMÁTICO COM SEGURANÇA
    BEGIN
        RAISE NOTICE 'Starting automatic score recalculation for concurso %', p_concurso_id;
        
        SET LOCAL statement_timeout = '60s';
        
        SELECT recalculate_all_scores_with_weights(p_concurso_id)
        INTO v_recalc_result;
        
        RESET statement_timeout;
        
        IF (v_recalc_result->>'success')::boolean THEN
            RAISE NOTICE 'Score recalculation completed successfully: % users updated', 
                         COALESCE((v_recalc_result->>'updatedCount')::integer, 0);
        ELSE
            RAISE WARNING 'Score recalculation failed: %', v_recalc_result->>'message';
        END IF;
        
    EXCEPTION
        WHEN OTHERS THEN
            RAISE WARNING 'Error during automatic recalculation (non-fatal): %', SQLERRM;
            RAISE NOTICE 'Answer key was saved successfully despite recalculation error';
    END;
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Gabarito salvo com sucesso. Recálculo automático iniciado.',
        'booklet_id', p_booklet_id,
        'answers_saved', v_answer_count
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'CRITICAL ERROR in save_consolidated_answer_key: %', SQLERRM;
        RETURN jsonb_build_object(
            'success', false,
            'message', SQLERRM,
            'booklet_id', p_booklet_id,
            'answers_saved', 0
        );
END;
$$;
