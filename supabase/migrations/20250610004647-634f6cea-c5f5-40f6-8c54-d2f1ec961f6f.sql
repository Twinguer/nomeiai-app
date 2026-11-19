
-- Corrigir a função save_consolidated_answer_key para usar constraint correto
CREATE OR REPLACE FUNCTION save_consolidated_answer_key(
    p_concurso_id uuid,
    p_booklet_id uuid,
    p_answers jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    v_existing_data jsonb;
    v_consolidated_data jsonb;
    v_booklet_key text;
BEGIN
    v_booklet_key := p_booklet_id::text;
    
    -- Buscar dados existentes
    SELECT consolidated_answer_data INTO v_existing_data
    FROM official_answer_weights
    WHERE concurso_id = p_concurso_id
    AND question_number = -1;
    
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
    
    -- Atualizar dados do caderno específico
    v_consolidated_data := jsonb_set(
        v_existing_data,
        ARRAY['booklets', v_booklet_key],
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
    
    -- Primeiro tentar atualizar se já existe
    UPDATE official_answer_weights 
    SET 
        consolidated_answer_data = v_consolidated_data,
        updated_at = now()
    WHERE concurso_id = p_concurso_id
    AND question_number = -1;
    
    -- Se não atualizou nenhuma linha, inserir nova
    IF NOT FOUND THEN
        INSERT INTO official_answer_weights (
            concurso_id,
            consolidated_answer_data,
            correct_answer,
            question_number,
            weight,
            section_type,
            created_at,
            updated_at
        ) VALUES (
            p_concurso_id,
            v_consolidated_data,
            'CONSOLIDATED',
            -1,
            1.0,
            'CONSOLIDATED',
            now(),
            now()
        );
    END IF;
    
    RETURN jsonb_build_object(
        'success', true,
        'booklet_id', v_booklet_key,
        'answers_saved', (SELECT COUNT(*) FROM jsonb_object_keys(p_answers))
    );
END;
$$;

-- Criar constraint único se não existir
DO $$
BEGIN
    -- Tentar criar constraint único para (concurso_id, question_number)
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'official_answer_weights_concurso_question_unique'
    ) THEN
        ALTER TABLE official_answer_weights 
        ADD CONSTRAINT official_answer_weights_concurso_question_unique 
        UNIQUE (concurso_id, question_number);
    END IF;
EXCEPTION
    WHEN duplicate_object THEN
        -- Constraint já existe, continuar
        NULL;
END $$;
