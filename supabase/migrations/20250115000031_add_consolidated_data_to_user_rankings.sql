-- =====================================================
-- MIGRATION: Adicionar campo consolidated_data à tabela user_rankings
-- OBJETIVO: Preparar estrutura para consolidação de respostas por usuário
-- DATA: 2025-01-15
-- =====================================================

-- 1. Adicionar campo consolidated_data JSONB
-- =====================================================
ALTER TABLE user_rankings 
ADD COLUMN consolidated_data JSONB DEFAULT '{}'::jsonb;

-- 2. Adicionar comentário explicativo
-- =====================================================
COMMENT ON COLUMN user_rankings.consolidated_data IS 'Dados consolidados de respostas organizados por concurso: {concurso_id: {answers: {booklet_id: {question: answer}}, metadata: {...}}}';

-- 3. Criar função de migração de dados existentes
-- =====================================================
CREATE OR REPLACE FUNCTION migrate_consolidated_data_to_user_rankings()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  user_record RECORD;
  concurso_record RECORD;
  v_consolidated_data JSONB;
  v_user_data JSONB;
  v_concurso_key TEXT;
BEGIN
  RAISE NOTICE 'Starting migration of consolidated data to user_rankings...';
  
  -- Processar cada registro de consolidated_answers_by_concurso
  FOR concurso_record IN 
    SELECT concurso_id, consolidated_data
    FROM consolidated_answers_by_concurso
    WHERE consolidated_data IS NOT NULL 
    AND consolidated_data != '{}'::jsonb
  LOOP
    v_concurso_key := concurso_record.concurso_id::text;
    
    -- Processar cada usuário neste concurso
    FOR user_record IN
      SELECT 
        (consolidated_data->'users'->key)::jsonb as user_data,
        key as user_id
      FROM jsonb_object_keys(concurso_record.consolidated_data->'users') as key
    LOOP
      -- Verificar se o usuário tem ranking neste concurso
      IF EXISTS (
        SELECT 1 FROM user_rankings 
        WHERE user_id = user_record.user_id::uuid 
        AND concurso_id = concurso_record.concurso_id
      ) THEN
        -- Preparar dados consolidados para este usuário
        v_consolidated_data := jsonb_build_object(
          v_concurso_key,
          jsonb_build_object(
            'answers', user_record.user_data->'answers',
            'metadata', user_record.user_data->'metadata'
          )
        );
        
        -- Atualizar user_rankings com dados consolidados
        UPDATE user_rankings 
        SET consolidated_data = v_consolidated_data
        WHERE user_id = user_record.user_id::uuid 
        AND concurso_id = concurso_record.concurso_id;
        
        RAISE NOTICE 'Migrated data for user % in concurso %', user_record.user_id, concurso_record.concurso_id;
      END IF;
    END LOOP;
  END LOOP;
  
  RAISE NOTICE 'Migration completed successfully';
END;
$$;

-- 4. Criar função para migrar pontuações subjetivas existentes
-- =====================================================
CREATE OR REPLACE FUNCTION migrate_subjective_scores_to_consolidated()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  user_record RECORD;
  v_concurso_key TEXT;
  v_subjective_scores JSONB;
BEGIN
  RAISE NOTICE 'Starting migration of subjective scores to consolidated structure...';
  
  FOR user_record IN 
    SELECT 
      id,
      concurso_id,
      discursive_score,
      case_study_1_score,
      case_study_2_score,
      case_study_3_score,
      subject_scores
    FROM user_rankings 
    WHERE (discursive_score IS NOT NULL OR case_study_1_score IS NOT NULL 
           OR case_study_2_score IS NOT NULL OR case_study_3_score IS NOT NULL)
    AND (subject_scores IS NULL OR subject_scores = '{}'::jsonb)
  LOOP
    v_concurso_key := user_record.concurso_id::text;
    
    -- Preparar pontuações subjetivas para este concurso
    v_subjective_scores := jsonb_build_object(
      v_concurso_key,
      jsonb_build_object(
        'discursive', COALESCE(user_record.discursive_score, 0),
        'case_study_1', COALESCE(user_record.case_study_1_score, 0),
        'case_study_2', COALESCE(user_record.case_study_2_score, 0),
        'case_study_3', COALESCE(user_record.case_study_3_score, 0),
        'other_subjective', 0
      )
    );
    
    -- Atualizar subject_scores com estrutura consolidada
    UPDATE user_rankings 
    SET subject_scores = v_subjective_scores
    WHERE id = user_record.id;
    
    RAISE NOTICE 'Migrated subjective scores for user ranking %', user_record.id;
  END LOOP;
  
  RAISE NOTICE 'Subjective scores migration completed successfully';
END;
$$;

-- 5. Executar migrações
-- =====================================================
SELECT migrate_consolidated_data_to_user_rankings();
SELECT migrate_subjective_scores_to_consolidated();

-- 6. Criar índices para performance
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_user_rankings_consolidated_data 
ON user_rankings USING GIN (consolidated_data);

-- 7. Log da migração
-- =====================================================
INSERT INTO migration_logs (
    migration_name,
    executed_at,
    status,
    details
) VALUES (
    'add_consolidated_data_to_user_rankings',
    NOW(),
    'completed',
    jsonb_build_object(
        'new_field', 'consolidated_data',
        'migration_functions_created', true,
        'data_migrated', true,
        'indexes_created', true
    )
);
