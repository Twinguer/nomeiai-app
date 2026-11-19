-- =====================================================
-- MIGRAÇÃO: Remoção das Tabelas Antigas de Estudo
-- =====================================================
-- Data: 2025-01-15
-- Descrição: Remove tabelas antigas que foram consolidadas na tabela user_study
-- Autor: Sistema de Migração Automatizada
-- =====================================================

-- Log da migração
INSERT INTO migration_logs (migration_name, details) 
VALUES (
    'remove_old_study_tables', 
    '{"description": "Remoção das tabelas antigas de estudo consolidadas na user_study", "tables_removed": ["study_sessions", "study_schedule", "study_statistics", "study_cycles", "study_cycles_v2", "study_subjects", "study_progress", "study_contests", "study_goals_tracking", "user_study_days"]}'::jsonb
);

-- =====================================================
-- 1. REMOVER FOREIGN KEYS PRIMEIRO
-- =====================================================

-- Remover foreign keys das tabelas de estudo
ALTER TABLE study_sessions DROP CONSTRAINT IF EXISTS study_sessions_schedule_session_id_fkey;
ALTER TABLE study_sessions DROP CONSTRAINT IF EXISTS study_sessions_study_contest_id_fkey;
ALTER TABLE study_sessions DROP CONSTRAINT IF EXISTS study_sessions_subject_id_fkey;
ALTER TABLE study_sessions DROP CONSTRAINT IF EXISTS study_sessions_user_id_fkey;

ALTER TABLE study_schedule DROP CONSTRAINT IF EXISTS study_schedule_subject_id_fkey;
ALTER TABLE study_schedule DROP CONSTRAINT IF EXISTS study_schedule_user_id_fkey;

ALTER TABLE study_progress DROP CONSTRAINT IF EXISTS study_progress_study_contest_id_fkey;
ALTER TABLE study_progress DROP CONSTRAINT IF EXISTS study_progress_subject_id_fkey;
ALTER TABLE study_progress DROP CONSTRAINT IF EXISTS study_progress_user_id_fkey;

ALTER TABLE study_subjects DROP CONSTRAINT IF EXISTS study_subjects_study_contest_id_fkey;
ALTER TABLE study_subjects DROP CONSTRAINT IF EXISTS study_subjects_user_id_fkey;

ALTER TABLE study_contests DROP CONSTRAINT IF EXISTS study_contests_user_id_fkey;

ALTER TABLE study_cycles DROP CONSTRAINT IF EXISTS study_cycles_user_id_fkey;

ALTER TABLE study_cycles_v2 DROP CONSTRAINT IF EXISTS study_cycles_v2_user_id_fkey;

ALTER TABLE study_goals_tracking DROP CONSTRAINT IF EXISTS study_goals_tracking_user_id_fkey;

ALTER TABLE user_study_days DROP CONSTRAINT IF EXISTS user_study_days_user_id_fkey;

-- =====================================================
-- 2. REMOVER ÍNDICES DAS TABELAS
-- =====================================================

-- Remover índices das tabelas de estudo
DROP INDEX IF EXISTS idx_study_sessions_user_id;
DROP INDEX IF EXISTS idx_study_sessions_date;
DROP INDEX IF EXISTS idx_study_sessions_subject_id;
DROP INDEX IF EXISTS idx_study_sessions_contest_id;

DROP INDEX IF EXISTS idx_study_schedule_user_id;
DROP INDEX IF EXISTS idx_study_schedule_day;
DROP INDEX IF EXISTS idx_study_schedule_subject_id;

DROP INDEX IF EXISTS idx_study_progress_user_id;
DROP INDEX IF EXISTS idx_study_progress_date;
DROP INDEX IF EXISTS idx_study_progress_subject_id;

DROP INDEX IF EXISTS idx_study_subjects_user_id;
DROP INDEX IF EXISTS idx_study_subjects_contest_id;

DROP INDEX IF EXISTS idx_study_contests_user_id;

DROP INDEX IF EXISTS idx_study_cycles_user_id;
DROP INDEX IF EXISTS idx_study_cycles_active;

DROP INDEX IF EXISTS idx_study_cycles_v2_user_id;
DROP INDEX IF EXISTS idx_study_cycles_v2_active;

DROP INDEX IF EXISTS idx_study_goals_tracking_user_id;

DROP INDEX IF EXISTS idx_user_study_days_user_id;
DROP INDEX IF EXISTS idx_user_study_days_date;

-- =====================================================
-- 3. REMOVER TRIGGERS E FUNÇÕES RELACIONADAS
-- =====================================================

-- Remover triggers das tabelas de estudo
DROP TRIGGER IF EXISTS update_study_sessions_updated_at ON study_sessions;
DROP TRIGGER IF EXISTS update_study_schedule_updated_at ON study_schedule;
DROP TRIGGER IF EXISTS update_study_progress_updated_at ON study_progress;
DROP TRIGGER IF EXISTS update_study_subjects_updated_at ON study_subjects;
DROP TRIGGER IF EXISTS update_study_contests_updated_at ON study_contests;
DROP TRIGGER IF EXISTS update_study_cycles_updated_at ON study_cycles;
DROP TRIGGER IF EXISTS update_study_cycles_v2_updated_at ON study_cycles_v2;
DROP TRIGGER IF EXISTS update_study_goals_tracking_updated_at ON study_goals_tracking;

-- Remover funções de trigger
DROP FUNCTION IF EXISTS update_study_sessions_updated_at();
DROP FUNCTION IF EXISTS update_study_schedule_updated_at();
DROP FUNCTION IF EXISTS update_study_progress_updated_at();
DROP FUNCTION IF EXISTS update_study_subjects_updated_at();
DROP FUNCTION IF EXISTS update_study_contests_updated_at();
DROP FUNCTION IF EXISTS update_study_cycles_updated_at();
DROP FUNCTION IF EXISTS update_study_cycles_v2_updated_at();
DROP FUNCTION IF EXISTS update_study_goals_tracking_updated_at();

-- =====================================================
-- 4. REMOVER TABELAS EM ORDEM DE DEPENDÊNCIA
-- =====================================================

-- Remover tabelas que dependem de outras (primeiro)
DROP TABLE IF EXISTS study_sessions CASCADE;
DROP TABLE IF EXISTS study_schedule CASCADE;
DROP TABLE IF EXISTS study_progress CASCADE;

-- Remover tabelas intermediárias
DROP TABLE IF EXISTS study_subjects CASCADE;
DROP TABLE IF EXISTS study_contests CASCADE;

-- Remover tabelas de ciclos
DROP TABLE IF EXISTS study_cycles CASCADE;
DROP TABLE IF EXISTS study_cycles_v2 CASCADE;

-- Remover tabelas de estatísticas e metas
DROP TABLE IF EXISTS study_statistics CASCADE;
DROP TABLE IF EXISTS study_goals_tracking CASCADE;

-- Remover tabelas de dias de estudo
DROP TABLE IF EXISTS user_study_days CASCADE;

-- =====================================================
-- 5. VERIFICAR REMOÇÃO COMPLETA
-- =====================================================

-- Verificar se as tabelas foram removidas
DO $$
DECLARE
    table_exists boolean;
    tables_to_check text[] := ARRAY[
        'study_sessions', 'study_schedule', 'study_statistics', 
        'study_cycles', 'study_cycles_v2', 'study_subjects', 
        'study_progress', 'study_contests', 'study_goals_tracking', 
        'user_study_days'
    ];
    table_name text;
    remaining_tables text[] := '{}';
BEGIN
    FOREACH table_name IN ARRAY tables_to_check
    LOOP
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = table_name
        ) INTO table_exists;
        
        IF table_exists THEN
            remaining_tables := array_append(remaining_tables, table_name);
        END IF;
    END LOOP;
    
    IF array_length(remaining_tables, 1) > 0 THEN
        RAISE WARNING 'Tabelas ainda existentes: %', remaining_tables;
    ELSE
        RAISE NOTICE 'Todas as tabelas antigas foram removidas com sucesso!';
    END IF;
END $$;

-- =====================================================
-- 6. ATUALIZAR ESTATÍSTICAS DO BANCO
-- =====================================================

-- Executar VACUUM para limpar espaço
VACUUM ANALYZE;

-- =====================================================
-- 7. LOG DE CONCLUSÃO
-- =====================================================

-- Atualizar log de migração
UPDATE migration_logs 
SET details = details || '{"status": "completed", "completed_at": "now()"}'::jsonb
WHERE migration_name = 'remove_old_study_tables';

-- =====================================================
-- MIGRAÇÃO CONCLUÍDA
-- =====================================================

