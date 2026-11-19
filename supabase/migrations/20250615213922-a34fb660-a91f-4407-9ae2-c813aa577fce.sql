
-- Remover trigger e função obsoletos que causam o erro "record NEW has no field question_number"
-- O trigger tenta acessar campos que não existem mais na estrutura atual da tabela

-- Primeiro, remover o trigger se existir
DROP TRIGGER IF EXISTS trigger_recalculate_on_answer_weight_change ON official_answer_weights;

-- Remover a função obsoleta que causa o erro
DROP FUNCTION IF EXISTS public.recalculate_scores_on_answer_weight_change();

-- Verificar se há outros triggers obsoletos na tabela official_answer_weights
-- e removê-los se necessário
DROP TRIGGER IF EXISTS validate_complete_answer_key_set_trigger ON official_answer_weights;
DROP TRIGGER IF EXISTS trigger_recalculate_scores ON official_answer_weights;

-- Log da operação para auditoria
INSERT INTO score_calculation_logs (
    calculation_type,
    calculation_details
) VALUES (
    'trigger_cleanup',
    jsonb_build_object(
        'operation', 'removed_obsolete_triggers',
        'table', 'official_answer_weights',
        'reason', 'triggers_trying_to_access_nonexistent_fields',
        'timestamp', now()
    )
);
