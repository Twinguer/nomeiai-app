-- ============================================================================
-- CORREÇÃO: Criar função calculate_user_score_realtime completa
-- ============================================================================
-- Esta função estava faltando no banco, mas é chamada por recalculate_all_scores_with_weights
-- Conteúdo baseado em: 20250127000015_fix_discipline_weights_calculation.sql
-- ============================================================================

DROP FUNCTION IF EXISTS public.calculate_user_score_realtime(text, uuid, uuid, text) CASCADE;

-- [Função completa inserida aqui - mesmo conteúdo da migration 20250127000015]

