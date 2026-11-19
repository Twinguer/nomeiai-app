-- Remove wrong_answer_penalty column
-- This logic can be moved to JSONB fields if needed

ALTER TABLE concursos DROP COLUMN IF EXISTS wrong_answer_penalty;

-- Add comment explaining the change
COMMENT ON TABLE concursos IS 'Penalty logic can be stored in JSONB fields if needed';













