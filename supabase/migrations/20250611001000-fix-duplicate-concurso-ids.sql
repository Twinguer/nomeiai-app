
-- Primeiro, remover duplicatas da tabela official_answer_weights
-- Manter apenas uma linha por concurso (a mais recente)

-- Backup dos dados existentes
CREATE TABLE IF NOT EXISTS official_answer_weights_backup_full AS 
SELECT * FROM official_answer_weights;

-- Remover duplicatas mantendo apenas o registro mais recente por concurso
DELETE FROM official_answer_weights 
WHERE id NOT IN (
    SELECT DISTINCT ON (concurso_id) id
    FROM official_answer_weights
    ORDER BY concurso_id, updated_at DESC, created_at DESC
);

-- Agora podemos aplicar a reestruturação
-- Remover constraints existentes
ALTER TABLE official_answer_weights 
DROP CONSTRAINT IF EXISTS section_type_check;

ALTER TABLE official_answer_weights 
DROP CONSTRAINT IF EXISTS official_answer_weights_concurso_question_unique;

-- Remover colunas desnecessárias (se ainda existirem)
ALTER TABLE official_answer_weights 
DROP COLUMN IF EXISTS question_number,
DROP COLUMN IF EXISTS correct_answer,
DROP COLUMN IF EXISTS weight,
DROP COLUMN IF EXISTS section_type,
DROP COLUMN IF EXISTS is_nullified,
DROP COLUMN IF EXISTS points_if_correct,
DROP COLUMN IF EXISTS points_if_wrong,
DROP COLUMN IF EXISTS subject_id,
DROP COLUMN IF EXISTS answer_data,
DROP COLUMN IF EXISTS booklet_id,
DROP COLUMN IF EXISTS answer_format,
DROP COLUMN IF EXISTS question_type;

-- Adicionar constraint único por concurso
ALTER TABLE official_answer_weights 
ADD CONSTRAINT official_answer_weights_concurso_unique 
UNIQUE (concurso_id);

-- Migrar dados do backup para a estrutura consolidada
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
            ),
            'metadata', jsonb_build_object(
              'total_questions', COUNT(*),
              'created_at', MIN(created_at),
              'updated_at', MAX(updated_at)
            )
          )
        ) FILTER (WHERE question_number IS NOT NULL AND question_number > 0),
        '{}'::jsonb
      ),
      'metadata', jsonb_build_object(
        'version', '2.0',
        'migrated_at', now(),
        'total_booklets', COUNT(DISTINCT COALESCE(booklet_id, gen_random_uuid()))
      )
    ) as consolidated_data,
    MIN(created_at) as created_at,
    MAX(updated_at) as updated_at
  FROM official_answer_weights_backup_full
  WHERE concurso_id IS NOT NULL
    AND question_number IS NOT NULL 
    AND question_number > 0
  GROUP BY concurso_id
)
UPDATE official_answer_weights 
SET 
  consolidated_answer_data = cd.consolidated_data,
  updated_at = cd.updated_at
FROM consolidated_data cd
WHERE official_answer_weights.concurso_id = cd.concurso_id;

-- Para concursos que não tinham dados no backup, inicializar estrutura vazia
UPDATE official_answer_weights 
SET consolidated_answer_data = jsonb_build_object(
  'booklets', '{}',
  'metadata', jsonb_build_object(
    'version', '2.0',
    'created_at', now(),
    'total_booklets', 0
  )
)
WHERE consolidated_answer_data IS NULL OR consolidated_answer_data = '{}'::jsonb;
