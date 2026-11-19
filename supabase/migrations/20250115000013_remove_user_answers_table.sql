-- =====================================================
-- MIGRATION: Remover tabela user_answers obsoleta
-- OBJETIVO: Simplificar arquitetura removendo tabela não utilizada
-- DATA: 2025-01-15
-- =====================================================

-- Verificar se há dados na tabela antes de remover
DO $$
DECLARE
    record_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO record_count FROM user_answers;
    
    IF record_count > 0 THEN
        RAISE NOTICE 'ATENÇÃO: Tabela user_answers contém % registros. Verifique se são necessários antes de prosseguir.', record_count;
        -- Não remover se houver dados - descomente a linha abaixo para forçar remoção
        -- RAISE EXCEPTION 'Tabela user_answers contém dados. Remoção cancelada por segurança.';
    ELSE
        RAISE NOTICE 'Tabela user_answers está vazia. Prosseguindo com a remoção.';
    END IF;
END $$;

-- Remover constraints e índices relacionados
DROP INDEX IF EXISTS idx_user_answers_unique_ranking_question;
DROP INDEX IF EXISTS idx_user_answers_user_ranking_id;
DROP INDEX IF EXISTS idx_user_answers_concurso_id;

-- Remover tabela user_answers
DROP TABLE IF EXISTS user_answers CASCADE;

-- Log da remoção
INSERT INTO migration_logs (
    migration_name,
    executed_at,
    status,
    details
) VALUES (
    'remove_user_answers_table',
    NOW(),
    'completed',
    jsonb_build_object(
        'table_removed', 'user_answers',
        'reason', 'Tabela obsoleta - dados migrados para consolidated_answers_by_concurso',
        'architecture_simplified', true
    )
);
