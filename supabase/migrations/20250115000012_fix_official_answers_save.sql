-- Corrigir salvamento do gabarito oficial para usar campo official_answers da tabela concursos
-- em vez da tabela official_answer_weights

CREATE OR REPLACE FUNCTION public.save_consolidated_answer_key(
    p_concurso_id uuid,
    p_booklet_id text,
    p_answers jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    v_existing_data JSONB;
    v_consolidated_data JSONB;
    v_booklet_answers JSONB := '{}';
    v_question_key TEXT;
    v_answer_data JSONB;
    v_answer_count INTEGER := 0;
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
    
    -- Log das respostas processadas
    RAISE NOTICE 'Processed % answers for booklet %', v_answer_count, p_booklet_id;
    
    -- Atualizar o caderno específico na estrutura consolidada
    v_consolidated_data := jsonb_set(
        v_existing_data,
        ARRAY[p_booklet_id],
        jsonb_build_object(
            'questions', v_booklet_answers,
            'metadata', jsonb_build_object(
                'total_questions', v_answer_count,
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
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Answer key saved successfully',
        'booklet_id', p_booklet_id,
        'answers_saved', v_answer_count
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error in save_consolidated_answer_key: %', SQLERRM;
        RETURN jsonb_build_object(
            'success', false,
            'message', SQLERRM,
            'booklet_id', p_booklet_id,
            'answers_saved', 0
        );
END;
$function$;




















