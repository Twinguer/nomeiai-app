
-- Migração robusta para consolidar dados e limpar estrutura da tabela official_answer_weights

-- Primeiro, verificar se existem dados para trabalhar
DO $$
DECLARE
    v_has_data BOOLEAN;
    v_has_consolidated BOOLEAN;
BEGIN
    -- Verificar se existem dados na tabela
    SELECT EXISTS(SELECT 1 FROM official_answer_weights) INTO v_has_data;
    
    -- Verificar se já existem dados consolidados
    SELECT EXISTS(
        SELECT 1 FROM official_answer_weights 
        WHERE consolidated_answer_data IS NOT NULL 
        AND jsonb_typeof(consolidated_answer_data) = 'object'
        AND consolidated_answer_data != '{}'
    ) INTO v_has_consolidated;
    
    RAISE NOTICE 'Tabela tem dados: %, Dados consolidados existem: %', v_has_data, v_has_consolidated;
    
    -- Se não há dados consolidados mas há dados na tabela, fazer consolidação
    IF v_has_data AND NOT v_has_consolidated THEN
        RAISE NOTICE 'Iniciando consolidação de dados existentes...';
        
        -- Fazer backup se não existe
        IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'official_answer_weights_backup_full') THEN
            CREATE TABLE official_answer_weights_backup_full AS 
            SELECT * FROM official_answer_weights;
            RAISE NOTICE 'Backup criado';
        END IF;
        
        -- Consolidar dados por concurso
        WITH consolidated_data AS (
            SELECT 
                concurso_id,
                jsonb_build_object(
                    'booklets', 
                    COALESCE(
                        jsonb_object_agg(
                            COALESCE(booklet_id::text, 'default'),
                            jsonb_build_object(
                                'answers', jsonb_object_agg(
                                    question_number::text,
                                    jsonb_build_object(
                                        'correct_answer', correct_answer,
                                        'weight', COALESCE(weight, 1.0),
                                        'section_type', COALESCE(section_type, 'basic'),
                                        'is_nullified', COALESCE(is_nullified, false),
                                        'answer_format', COALESCE(answer_format, 'OBJECTIVE'),
                                        'question_type', COALESCE(question_type, 'MULTIPLE_CHOICE')
                                    )
                                ) FILTER (WHERE question_number IS NOT NULL),
                                'metadata', jsonb_build_object(
                                    'total_questions', COUNT(*),
                                    'created_at', MIN(created_at),
                                    'updated_at', MAX(updated_at)
                                )
                            )
                        ) FILTER (WHERE question_number IS NOT NULL),
                        '{}'::jsonb
                    ),
                    'metadata', jsonb_build_object(
                        'version', '2.0',
                        'migrated_at', now(),
                        'total_booklets', COUNT(DISTINCT COALESCE(booklet_id, 'default'))
                    )
                ) as consolidated_data,
                MIN(created_at) as created_at,
                MAX(updated_at) as updated_at
            FROM official_answer_weights
            WHERE concurso_id IS NOT NULL
            GROUP BY concurso_id
        )
        UPDATE official_answer_weights 
        SET consolidated_answer_data = cd.consolidated_data
        FROM consolidated_data cd
        WHERE official_answer_weights.concurso_id = cd.concurso_id;
        
        RAISE NOTICE 'Consolidação concluída';
    END IF;
    
    -- Se ainda não há dados, criar estrutura vazia para permitir a limpeza
    IF NOT v_has_data THEN
        RAISE NOTICE 'Tabela vazia, permitindo limpeza de estrutura';
    END IF;
END $$;

-- Agora remover as colunas desnecessárias
ALTER TABLE official_answer_weights 
DROP COLUMN IF EXISTS section_type,
DROP COLUMN IF EXISTS correct_answer,
DROP COLUMN IF EXISTS question_number,
DROP COLUMN IF EXISTS weight,
DROP COLUMN IF EXISTS is_nullified,
DROP COLUMN IF EXISTS points_if_correct,
DROP COLUMN IF EXISTS points_if_wrong,
DROP COLUMN IF EXISTS subject_id,
DROP COLUMN IF EXISTS answer_data,
DROP COLUMN IF EXISTS booklet_id,
DROP COLUMN IF EXISTS answer_format,
DROP COLUMN IF EXISTS question_type;

-- Verificar estrutura final
SELECT 
    'Estrutura final da tabela official_answer_weights:' as info,
    column_name, 
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'official_answer_weights' 
ORDER BY ordinal_position;
