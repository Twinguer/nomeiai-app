-- Remove colunas de cotas das subjetivas que não foram removidas na migração anterior
-- Essas colunas agora são armazenadas no campo JSONB 'subjects'

-- Remover colunas de cotas das subjetivas
ALTER TABLE concursos DROP COLUMN IF EXISTS discursive_minimum_score_cotas;
ALTER TABLE concursos DROP COLUMN IF EXISTS case_study_1_minimum_score_cotas;
ALTER TABLE concursos DROP COLUMN IF EXISTS case_study_2_minimum_score_cotas;
ALTER TABLE concursos DROP COLUMN IF EXISTS case_study_3_minimum_score_cotas;
ALTER TABLE concursos DROP COLUMN IF EXISTS other_subjective_minimum_score_cotas;

-- Adicionar comentário explicativo
COMMENT ON TABLE concursos IS 'Tabela de concursos com dados de cotas e subjetivas armazenados em campos JSONB: has_cota e subjects';

-- Log da implementação
INSERT INTO score_calculation_logs (user_ranking_id, calculation_type, calculation_details)
VALUES (
    '00000000-0000-0000-0000-000000000000'::uuid, 
    'remove_quota_subjective_columns', 
    jsonb_build_object(
        'message', 'Removidas colunas de cotas das subjetivas que não foram removidas na migração anterior',
        'columns_removed', ARRAY[
            'discursive_minimum_score_cotas',
            'case_study_1_minimum_score_cotas', 
            'case_study_2_minimum_score_cotas',
            'case_study_3_minimum_score_cotas',
            'other_subjective_minimum_score_cotas'
        ],
        'timestamp', NOW(),
        'version', '1.0',
        'reason', 'Dados agora armazenados no campo JSONB subjects'
    )
);
