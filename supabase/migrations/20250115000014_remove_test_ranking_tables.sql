-- =====================================================
-- MIGRATION: Remove Test Ranking Tables
-- OBJETIVO: Remover tabelas de teste user_ranking_new e create_ranking_new
-- DATA: 2025-01-15
-- =====================================================

-- 1. Remover funções relacionadas primeiro
-- =====================================================
DROP FUNCTION IF EXISTS calculate_user_ranking_score_v2(UUID);
DROP FUNCTION IF EXISTS get_rankings_with_filters(TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS get_user_rankings_for_ranking(UUID, TEXT, INTEGER, INTEGER);

-- 2. Remover índices
-- =====================================================
DROP INDEX IF EXISTS idx_create_ranking_new_titulo;
DROP INDEX IF EXISTS idx_create_ranking_new_orgao;
DROP INDEX IF EXISTS idx_create_ranking_new_banca;
DROP INDEX IF EXISTS idx_create_ranking_new_status;
DROP INDEX IF EXISTS idx_create_ranking_new_creator;
DROP INDEX IF EXISTS idx_create_ranking_new_created_at;
DROP INDEX IF EXISTS idx_user_ranking_new_ranking_id;
DROP INDEX IF EXISTS idx_user_ranking_new_user_id;
DROP INDEX IF EXISTS idx_user_ranking_new_score;
DROP INDEX IF EXISTS idx_user_ranking_new_position;

-- 3. Remover tabelas (CASCADE remove dependências)
-- =====================================================
DROP TABLE IF EXISTS user_ranking_new CASCADE;
DROP TABLE IF EXISTS create_ranking_new CASCADE;

-- 4. Comentários de documentação
-- =====================================================
COMMENT ON SCHEMA public IS 'Test ranking tables (user_ranking_new, create_ranking_new) removed - system uses legacy structure (user_rankings, concursos)';
