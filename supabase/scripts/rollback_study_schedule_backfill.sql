-- Rollback da migration 20260525120000_backfill_study_schedule_from_weekly.sql
-- Restaura study_schedule a partir do backup. NÃO remove entradas adicionadas manualmente após o backfill
-- se você já alterou dados — revise linha a linha antes de executar em produção.

-- Pré-visualização (read-only):
-- SELECT user_id, jsonb_array_length(study_schedule) AS current_len,
--        jsonb_array_length(b.study_schedule) AS backup_len
-- FROM user_study_v2 u
-- JOIN user_study_v2_migration_backup b
--   ON b.user_id = u.user_id AND b.migration_name = '20260525120000_backfill_study_schedule';

BEGIN;

UPDATE public.user_study_v2 u
SET study_schedule = b.study_schedule,
    updated_at = now()
FROM public.user_study_v2_migration_backup b
WHERE b.user_id = u.user_id
  AND b.migration_name = '20260525120000_backfill_study_schedule';

-- Opcional: remover backup após confirmar rollback
-- DELETE FROM public.user_study_v2_migration_backup
-- WHERE migration_name = '20260525120000_backfill_study_schedule';

COMMIT;
