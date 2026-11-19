-- Remove unused tables from database
-- These tables are not referenced in the application code

-- Drop answer_key_access_log (depends on answer_key)
DROP TABLE IF EXISTS public.answer_key_access_log CASCADE;

-- Drop answer_key (old table replaced by official_answer_weights)
DROP TABLE IF EXISTS public.answer_key CASCADE;

-- Drop concurso_subjects (replaced by JSON field in concursos table)
DROP TABLE IF EXISTS public.concurso_subjects CASCADE;

-- Drop convocai (empty/test table)
DROP TABLE IF EXISTS public.convocai CASCADE;

-- Drop question_blocks (unused feature)
DROP TABLE IF EXISTS public.question_blocks CASCADE;

-- Drop user_answers_backup (old backup table no longer needed)
DROP TABLE IF EXISTS public.user_answers_backup CASCADE;

-- Drop job_titles (unused table)
DROP TABLE IF EXISTS public.job_titles CASCADE;

-- Drop unused functions related to question_blocks
DROP FUNCTION IF EXISTS public.manage_question_blocks(text, uuid, jsonb) CASCADE;
DROP FUNCTION IF EXISTS public.calculate_score_with_blocks(uuid) CASCADE;