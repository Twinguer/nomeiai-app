-- =====================================================
-- MIGRATION: Remove exam_booklets Table
-- OBJETIVO: Remover tabela exam_booklets (dados agora em concursos.exam_booklets JSONB)
-- DATA: 2025-01-15
-- =====================================================

-- 1. Verificar se há dados na tabela exam_booklets antes de remover
-- =====================================================
DO $$
DECLARE
  booklet_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO booklet_count FROM exam_booklets;
  
  IF booklet_count > 0 THEN
    RAISE NOTICE 'Tabela exam_booklets contém % registros. Verifique se os dados foram migrados para concursos.exam_booklets JSONB.', booklet_count;
  ELSE
    RAISE NOTICE 'Tabela exam_booklets está vazia. Removendo com segurança.';
  END IF;
END $$;

-- 2. Remover função relacionada
-- =====================================================
DROP FUNCTION IF EXISTS manage_exam_booklets(TEXT, UUID, UUID, TEXT, INTEGER, JSONB);

-- 3. Remover tabela (CASCADE remove dependências)
-- =====================================================
DROP TABLE IF EXISTS exam_booklets CASCADE;

-- 4. Comentários de documentação
-- =====================================================
COMMENT ON SCHEMA public IS 'exam_booklets table removed - data now stored in concursos.exam_booklets JSONB column';
