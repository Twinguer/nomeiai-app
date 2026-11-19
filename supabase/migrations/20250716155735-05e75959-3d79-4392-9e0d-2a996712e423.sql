-- Corrigir problema de constraint única na tabela official_answer_weights
-- Primeiro, adicionar constraint única para concurso_id
ALTER TABLE official_answer_weights 
ADD CONSTRAINT official_answer_weights_concurso_id_unique UNIQUE (concurso_id);

-- Atualizar função save_consolidated_answer_key com upsert correto
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
    
    -- Buscar dados consolidados existentes
    SELECT COALESCE(consolidated_answer_data, '{"booklets": {}, "metadata": {"version": "1.0"}}'::jsonb)
    INTO v_existing_data
    FROM official_answer_weights
    WHERE concurso_id = p_concurso_id;
    
    -- Se não encontrar, inicializar estrutura padrão
    IF v_existing_data IS NULL THEN
        v_existing_data := '{"booklets": {}, "metadata": {"version": "1.0"}}'::jsonb;
    END IF;
    
    -- Garantir que booklets existe
    IF NOT (v_existing_data ? 'booklets') THEN
        v_existing_data := jsonb_set(v_existing_data, '{booklets}', '{}'::jsonb);
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
        ARRAY['booklets', p_booklet_id],
        jsonb_build_object(
            'answers', v_booklet_answers,
            'metadata', jsonb_build_object(
                'total_questions', v_answer_count,
                'last_updated', now(),
                'booklet_name', p_booklet_id
            )
        )
    );
    
    -- Atualizar metadados globais
    v_consolidated_data := jsonb_set(
        v_consolidated_data,
        '{metadata,last_updated}',
        to_jsonb(now())
    );
    
    -- Upsert dos dados consolidados (agora com constraint única funcionando)
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
    
    RAISE NOTICE 'Successfully saved consolidated answer key for concurso % booklet %', p_concurso_id, p_booklet_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'booklet_id', p_booklet_id,
        'answers_saved', v_answer_count,
        'message', 'Answer key saved successfully'
    );
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error in save_consolidated_answer_key: %', SQLERRM;
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM,
        'error_detail', SQLSTATE
    );
END;
$function$;