-- ROLLBACK: Remover campos de mínimo global se der problema
-- Use este arquivo se a implementação de regras de mínimo causar problemas

-- Remover campos de mínimo global
ALTER TABLE concursos 
DROP COLUMN IF EXISTS has_minimum_score,
DROP COLUMN IF EXISTS total_minimum_score;

-- Restaurar comentário original
COMMENT ON TABLE concursos IS 'Minimum score data now stored in JSONB fields: subjects and has_cota';

-- Log do rollback
INSERT INTO score_calculation_logs (user_ranking_id, calculation_type, calculation_details)
VALUES (
    '00000000-0000-0000-0000-000000000000'::uuid, 
    'rollback_minimum_global_fields', 
    jsonb_build_object(
        'message', 'ROLLBACK: Removed has_minimum_score and total_minimum_score columns',
        'timestamp', NOW(),
        'reason', 'Rollback due to implementation issues'
    )
);

-- Comentário para identificar que é rollback
COMMENT ON FUNCTION calculate_user_score_realtime IS 'ROLLBACK: Função restaurada para versão anterior sem regras de mínimo global';
