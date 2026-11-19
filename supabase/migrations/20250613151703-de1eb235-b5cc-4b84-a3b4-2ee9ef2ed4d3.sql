
-- Remover TODAS as versões da função para evitar conflitos de sobrecarga
DROP FUNCTION IF EXISTS public.save_consolidated_answer_key(uuid, text, jsonb);
DROP FUNCTION IF EXISTS public.save_consolidated_answer_key(uuid, uuid, jsonb);
DROP FUNCTION IF EXISTS public.save_consolidated_answer_key CASCADE;

-- Recriar apenas a versão correta com booklet_id como text
CREATE OR REPLACE FUNCTION public.save_consolidated_answer_key(
  p_concurso_id uuid,
  p_booklet_id text,
  p_answers jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
AS $function$
DECLARE
    v_existing_data jsonb;
    v_consolidated_data jsonb;
    v_booklet_answers jsonb := '{}';
    v_question_key text;
    v_answer_data jsonb;
BEGIN
    -- Log de entrada
    RAISE NOTICE 'save_consolidated_answer_key: concurso_id=%, booklet_id=%, answers=%', p_concurso_id, p_booklet_id, p_answers;
    
    -- Buscar dados existentes APENAS pela estrutura consolidada
    SELECT consolidated_answer_data INTO v_existing_data
    FROM official_answer_weights
    WHERE concurso_id = p_concurso_id;
    
    -- Se não existir, criar estrutura base
    IF v_existing_data IS NULL THEN
        v_existing_data := jsonb_build_object(
            'booklets', '{}',
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
    
    -- Processar todas as respostas do caderno
    FOR v_question_key, v_answer_data IN
        SELECT * FROM jsonb_each(p_answers)
    LOOP
        v_booklet_answers := jsonb_set(
            v_booklet_answers,
            ARRAY[v_question_key],
            v_answer_data
        );
    END LOOP;
    
    -- Log das respostas processadas
    RAISE NOTICE 'Processed % answers for booklet %', jsonb_object_length(v_booklet_answers), p_booklet_id;
    
    -- Atualizar o caderno específico
    v_consolidated_data := jsonb_set(
        v_existing_data,
        ARRAY['booklets', p_booklet_id],
        jsonb_build_object(
            'answers', v_booklet_answers,
            'metadata', jsonb_build_object(
                'total_questions', jsonb_object_length(v_booklet_answers),
                'last_updated', now(),
                'booklet_name', p_booklet_id
            )
        )
    );
    
    -- Atualizar metadados globais
    v_consolidated_data := jsonb_set(
        v_consolidated_data,
        ARRAY['metadata', 'last_updated'],
        to_jsonb(now())
    );
    
    -- Inserir ou atualizar usando APENAS as colunas que existem
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
        'answers_saved', jsonb_object_length(v_booklet_answers)
    );
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error in save_consolidated_answer_key: %', SQLERRM;
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM
    );
END;
$function$;
