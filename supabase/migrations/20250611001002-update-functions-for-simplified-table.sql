
-- Atualizar funções para trabalhar com a estrutura simplificada da tabela official_answer_weights

-- Função simplificada para atualizar resposta com peso
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
    v_booklet_key text := 'default';
    v_answer_data jsonb;
BEGIN
    -- Buscar dados consolidados existentes
    SELECT consolidated_answer_data INTO v_consolidated_data
    FROM official_answer_weights
    WHERE concurso_id = p_concurso_id;
    
    -- Se não existir dados consolidados, criar estrutura base
    IF v_consolidated_data IS NULL THEN
        v_consolidated_data := jsonb_build_object(
            'booklets', jsonb_build_object(
                'default', jsonb_build_object(
                    'answers', '{}',
                    'metadata', jsonb_build_object(
                        'total_questions', 0,
                        'created_at', now()
                    )
                )
            ),
            'metadata', jsonb_build_object(
                'version', '2.0',
                'created_at', now(),
                'total_booklets', 1
            )
        );
        
        -- Inserir nova linha se não existir
        INSERT INTO official_answer_weights (concurso_id, consolidated_answer_data, created_at, updated_at)
        VALUES (p_concurso_id, v_consolidated_data, now(), now())
        ON CONFLICT (concurso_id) DO NOTHING;
    END IF;
    
    -- Garantir que existe a estrutura de cadernos
    IF v_consolidated_data->'booklets' IS NULL THEN
        v_consolidated_data := jsonb_set(
            v_consolidated_data,
            ARRAY['booklets'],
            jsonb_build_object(
                'default', jsonb_build_object(
                    'answers', '{}',
                    'metadata', jsonb_build_object(
                        'total_questions', 0,
                        'created_at', now()
                    )
                )
            )
        );
    END IF;
    
    -- Se não existe caderno default, criar
    IF v_consolidated_data->'booklets'->'default' IS NULL THEN
        v_consolidated_data := jsonb_set(
            v_consolidated_data,
            ARRAY['booklets', 'default'],
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
    
    -- Atualizar a resposta específica no caderno default
    v_consolidated_data := jsonb_set(
        v_consolidated_data,
        ARRAY['booklets', 'default', 'answers', p_question_number::text],
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
    WHERE concurso_id = p_concurso_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'booklet_key', v_booklet_key,
        'question_number', p_question_number,
        'answer_data', v_answer_data
    );
END;
$$;

-- Função simplificada para obter gabarito consolidado
CREATE OR REPLACE FUNCTION get_consolidated_answer_key(p_concurso_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    v_result jsonb;
BEGIN
    SELECT consolidated_answer_data INTO v_result
    FROM official_answer_weights
    WHERE concurso_id = p_concurso_id;
    
    -- Se não existir, retornar estrutura vazia
    IF v_result IS NULL THEN
        v_result := jsonb_build_object(
            'booklets', '{}',
            'metadata', jsonb_build_object(
                'version', '2.0',
                'total_booklets', 0
            )
        );
    END IF;
    
    RETURN v_result;
END;
$$;

-- Função simplificada para salvar gabarito consolidado
CREATE OR REPLACE FUNCTION save_consolidated_answer_key(
    p_concurso_id uuid, 
    p_booklet_id text, 
    p_answers jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    v_existing_data jsonb;
    v_consolidated_data jsonb;
BEGIN
    -- Buscar dados existentes
    SELECT consolidated_answer_data INTO v_existing_data
    FROM official_answer_weights
    WHERE concurso_id = p_concurso_id;
    
    -- Se não existir, criar estrutura base
    IF v_existing_data IS NULL THEN
        v_existing_data := jsonb_build_object(
            'booklets', '{}',
            'metadata', jsonb_build_object(
                'version', '2.0',
                'created_at', now()
            )
        );
    END IF;
    
    -- Atualizar dados do caderno específico
    v_consolidated_data := jsonb_set(
        v_existing_data,
        ARRAY['booklets', p_booklet_id],
        jsonb_build_object(
            'answers', p_answers,
            'metadata', jsonb_build_object(
                'total_questions', (SELECT COUNT(*) FROM jsonb_object_keys(p_answers)),
                'updated_at', now()
            )
        )
    );
    
    -- Atualizar metadados gerais
    v_consolidated_data := jsonb_set(
        v_consolidated_data,
        ARRAY['metadata', 'last_updated'],
        to_jsonb(now())
    );
    
    -- Inserir ou atualizar
    INSERT INTO official_answer_weights (concurso_id, consolidated_answer_data, created_at, updated_at)
    VALUES (p_concurso_id, v_consolidated_data, now(), now())
    ON CONFLICT (concurso_id) 
    DO UPDATE SET 
        consolidated_answer_data = EXCLUDED.consolidated_answer_data,
        updated_at = EXCLUDED.updated_at;
    
    RETURN jsonb_build_object(
        'success', true,
        'booklet_id', p_booklet_id,
        'answers_saved', (SELECT COUNT(*) FROM jsonb_object_keys(p_answers))
    );
END;
$$;

-- Adicionar constraint único se não existir
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'official_answer_weights_concurso_unique'
    ) THEN
        ALTER TABLE official_answer_weights 
        ADD CONSTRAINT official_answer_weights_concurso_unique 
        UNIQUE (concurso_id);
    END IF;
END $$;
