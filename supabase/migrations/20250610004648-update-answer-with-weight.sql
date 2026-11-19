
-- Criar função para atualizar resposta individual no gabarito consolidado
CREATE OR REPLACE FUNCTION update_answer_with_weight(
    p_concurso_id uuid,
    p_question_number integer,
    p_correct_answer text,
    p_weight numeric,
    p_is_nullified boolean,
    p_section_type text
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    v_consolidated_data jsonb;
    v_booklets jsonb;
    v_booklet_key text;
    v_booklet_data jsonb;
    v_answer_data jsonb;
BEGIN
    -- Buscar dados consolidados existentes
    SELECT consolidated_answer_data INTO v_consolidated_data
    FROM official_answer_weights
    WHERE concurso_id = p_concurso_id
    AND question_number = -1;
    
    -- Se não existir dados consolidados, retornar erro
    IF v_consolidated_data IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Nenhum gabarito consolidado encontrado para este concurso'
        );
    END IF;
    
    -- Buscar o primeiro caderno disponível (ou usar 'default')
    v_booklets := v_consolidated_data->'booklets';
    
    IF v_booklets IS NULL OR jsonb_typeof(v_booklets) = 'null' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Nenhum caderno encontrado no gabarito consolidado'
        );
    END IF;
    
    -- Pegar a primeira chave de caderno disponível
    SELECT key INTO v_booklet_key
    FROM jsonb_object_keys(v_booklets) AS key
    LIMIT 1;
    
    IF v_booklet_key IS NULL THEN
        v_booklet_key := 'default';
        -- Criar estrutura de caderno padrão
        v_consolidated_data := jsonb_set(
            v_consolidated_data,
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
    
    -- Criar dados da resposta
    v_answer_data := jsonb_build_object(
        'correct_answer', p_correct_answer,
        'weight', p_weight,
        'section_type', p_section_type,
        'is_nullified', p_is_nullified,
        'answer_format', 'OBJECTIVE',
        'question_type', 'MULTIPLE_CHOICE'
    );
    
    -- Atualizar a resposta específica no caderno
    v_consolidated_data := jsonb_set(
        v_consolidated_data,
        ARRAY['booklets', v_booklet_key, 'answers', p_question_number::text],
        v_answer_data
    );
    
    -- Atualizar metadados
    v_consolidated_data := jsonb_set(
        v_consolidated_data,
        ARRAY['metadata', 'last_updated'],
        to_jsonb(now())
    );
    
    -- Salvar dados atualizados
    UPDATE official_answer_weights 
    SET 
        consolidated_answer_data = v_consolidated_data,
        updated_at = now()
    WHERE concurso_id = p_concurso_id
    AND question_number = -1;
    
    RETURN jsonb_build_object(
        'success', true,
        'booklet_key', v_booklet_key,
        'question_number', p_question_number,
        'answer_data', v_answer_data
    );
END;
$$;
