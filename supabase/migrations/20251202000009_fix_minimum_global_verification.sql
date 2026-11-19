-- ============================================================================
-- CORREÇÃO: Garantir que mínimo global seja verificado corretamente
-- ============================================================================
-- PROBLEMA: Rankings antigos podem ter sido calculados antes do mínimo ser configurado
-- SOLUÇÃO: Garantir que a verificação do mínimo global está correta na função
-- ============================================================================

-- A função calculate_user_score_realtime já verifica corretamente:
-- v_objective_score < v_global_minimum_score (apenas score objetivo, sem subjetivas)
-- Esta migration apenas garante que a verificação está explícita e documentada

-- Não há alteração necessária na função, apenas documentação
-- A verificação já está correta na linha 466 da migration 20250127000015

COMMENT ON FUNCTION public.calculate_user_score_realtime IS 
'Calcula score do usuário e verifica mínimos. 
IMPORTANTE: O mínimo global (minimum_total_score) é verificado APENAS contra o score objetivo (v_objective_score), 
NÃO inclui pontuações subjetivas. As subjetivas têm seus próprios mínimos separados.';





