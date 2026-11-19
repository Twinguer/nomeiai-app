-- Remove minimum score columns that are now replaced by JSONB fields
-- These are now handled by the subjects JSONB structure

ALTER TABLE concursos DROP COLUMN IF EXISTS has_minimum_score;
ALTER TABLE concursos DROP COLUMN IF EXISTS minimum_score_type;
ALTER TABLE concursos DROP COLUMN IF EXISTS minimum_score_unit_type;
ALTER TABLE concursos DROP COLUMN IF EXISTS total_minimum_score;

-- Add comment explaining the change
COMMENT ON TABLE concursos IS 'Minimum score data now stored in JSONB fields: subjects and has_cota';













