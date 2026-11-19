-- ============================================================================
-- CORREÇÃO: Normalização de reservation_type na função calculate_user_score_realtime
-- ============================================================================
-- PROBLEMA: A função não normaliza "AC" para "Ampla Concorrência", causando
--           que usuários com "AC" sejam tratados como cota e não sejam eliminados
--           mesmo quando estão abaixo do mínimo global.
-- SOLUÇÃO: Adicionar normalização do reservation_type antes de verificar se é cota
-- ============================================================================

-- A correção foi aplicada diretamente no arquivo 20250127000015_fix_discipline_weights_calculation.sql
-- Esta migration apenas documenta a correção

COMMENT ON FUNCTION public.calculate_user_score_realtime IS 
'Calcula score do usuário e verifica mínimos. 
IMPORTANTE: O mínimo global (minimum_total_score) é verificado APENAS contra o score objetivo (v_objective_score), 
NÃO inclui pontuações subjetivas. As subjetivas têm seus próprios mínimos separados.
CORREÇÃO: Normaliza reservation_type ("AC" -> "Ampla Concorrência") antes de verificar se é cota.';





