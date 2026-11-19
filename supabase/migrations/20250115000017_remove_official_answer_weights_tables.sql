-- =====================================================
-- MIGRATION: Remove official_answer_weights Tables
-- OBJETIVO: Remover tabelas obsoletas official_answer_weights e official_answer_weights_backup
-- DATA: 2025-01-15
-- =====================================================

-- 1. Verificar dados antes de remover
-- =====================================================
DO $$
DECLARE
  weights_count INTEGER;
  backup_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO weights_count FROM official_answer_weights;
  SELECT COUNT(*) INTO backup_count FROM official_answer_weights_backup;
  
  IF weights_count > 0 THEN
    RAISE NOTICE 'Tabela official_answer_weights contém % registros. Dados já migrados para concursos.official_answers JSONB.', weights_count;
  ELSE
    RAISE NOTICE 'Tabela official_answer_weights está vazia.';
  END IF;
  
  IF backup_count > 0 THEN
    RAISE NOTICE 'Tabela official_answer_weights_backup contém % registros de backup.', backup_count;
  ELSE
    RAISE NOTICE 'Tabela official_answer_weights_backup está vazia.';
  END IF;
END $$;

-- 2. Remover funções que usam official_answer_weights
-- =====================================================
DROP FUNCTION IF EXISTS update_answer_with_weight(UUID, INTEGER, TEXT, NUMERIC, BOOLEAN, TEXT);
DROP FUNCTION IF EXISTS update_answer_with_weight(UUID, INTEGER, TEXT, NUMERIC, BOOLEAN, TEXT, TEXT);
DROP FUNCTION IF EXISTS update_official_answers_and_recalculate(JSONB, UUID);

-- 3. Remover índices relacionados
-- =====================================================
DROP INDEX IF EXISTS idx_official_answer_weights_concurso_id;
DROP INDEX IF EXISTS idx_official_answer_weights_question_number;
DROP INDEX IF EXISTS idx_official_answer_weights_section_type;

-- 4. Remover tabelas (CASCADE remove dependências)
-- =====================================================
DROP TABLE IF EXISTS official_answer_weights CASCADE;
DROP TABLE IF EXISTS official_answer_weights_backup CASCADE;

-- 5. Comentários de documentação
-- =====================================================
COMMENT ON SCHEMA public IS 'official_answer_weights tables removed - data now stored in concursos.official_answers JSONB column';
