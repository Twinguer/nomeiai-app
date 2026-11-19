-- Remove old quota and subjective columns that are now replaced by JSONB fields
-- Keep total_minimum_score and has_minimum_score as they are used for global minimum

-- Remove old quota columns (replaced by has_cota JSONB)
ALTER TABLE concursos DROP COLUMN IF EXISTS has_ampla_concorrencia;
ALTER TABLE concursos DROP COLUMN IF EXISTS has_ppp;
ALTER TABLE concursos DROP COLUMN IF EXISTS has_pcd;
ALTER TABLE concursos DROP COLUMN IF EXISTS has_hipossuficientes;
ALTER TABLE concursos DROP COLUMN IF EXISTS has_indigenas;
ALTER TABLE concursos DROP COLUMN IF EXISTS has_transsexuais;
ALTER TABLE concursos DROP COLUMN IF EXISTS has_quota_minimum_score;
ALTER TABLE concursos DROP COLUMN IF EXISTS quota_minimum_score;
ALTER TABLE concursos DROP COLUMN IF EXISTS quota_minimum_score_unit_type;

-- Remove old subjective columns (replaced by subjects JSONB)
ALTER TABLE concursos DROP COLUMN IF EXISTS has_discursive;
ALTER TABLE concursos DROP COLUMN IF EXISTS has_case_study_1;
ALTER TABLE concursos DROP COLUMN IF EXISTS has_case_study_2;
ALTER TABLE concursos DROP COLUMN IF EXISTS has_case_study_3;
ALTER TABLE concursos DROP COLUMN IF EXISTS has_other_subjective;
ALTER TABLE concursos DROP COLUMN IF EXISTS other_subjective_name;
ALTER TABLE concursos DROP COLUMN IF EXISTS discursive_minimum_score;
ALTER TABLE concursos DROP COLUMN IF EXISTS case_study_1_minimum_score;
ALTER TABLE concursos DROP COLUMN IF EXISTS case_study_2_minimum_score;
ALTER TABLE concursos DROP COLUMN IF EXISTS case_study_3_minimum_score;
ALTER TABLE concursos DROP COLUMN IF EXISTS other_subjective_minimum_score;

-- Add comment explaining the change
COMMENT ON TABLE concursos IS 'Quota and subjective data now stored in JSONB fields: has_cota and subjects';













