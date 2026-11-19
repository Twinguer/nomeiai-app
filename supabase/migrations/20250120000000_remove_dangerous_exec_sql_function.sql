-- =====================================================
-- MIGRATION: Remover função perigosa exec_sql()
-- OBJETIVO: Eliminar vulnerabilidade crítica de SQL injection
-- DATA: 2025-01-20
-- =====================================================
-- 
-- ⚠️ SEGURANÇA CRÍTICA: Esta função permite execução de SQL dinâmico
-- sem validação, representando risco extremo de SQL injection.
-- 
-- A função não está sendo usada no código e não é necessária.
-- Migrations devem ser executadas via Supabase CLI, não via RPC.
-- =====================================================

-- Remover a função exec_sql() se existir
DROP FUNCTION IF EXISTS public.exec_sql(TEXT);

-- Comentário explicativo
COMMENT ON SCHEMA public IS 'Função exec_sql() removida por questões de segurança - não permite execução de SQL dinâmico não validado';

