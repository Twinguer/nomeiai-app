-- ============================================================================
-- SCRIPT DE VERIFICAÇÃO: Cálculo de Mínimos no CNU - Analista Administrativo
-- ============================================================================
-- Este script verifica:
-- 1. Mínimos configurados no concurso
-- 2. Scores objetivos dos usuários
-- 3. Flag below_minimum salvo
-- 4. Comparação entre score objetivo e mínimo global
-- ============================================================================

-- 1. Verificar mínimos configurados no CNU
SELECT 
  id,
  titulo,
  orgao,
  disciplines->>'minimum_total_score' as min_total_ac,
  disciplines->>'minimum_total_score_cotas' as min_total_cotas,
  exam_type
FROM concursos
WHERE titulo LIKE '%CNU%' 
  AND orgao LIKE '%Analista Administrativo%'
ORDER BY created_at DESC
LIMIT 5;

-- 2. Verificar usuários com scores baixos que deveriam estar eliminados
-- (Assumindo que o concurso_id será substituído manualmente)
DO $$
DECLARE
  v_concurso_id uuid;
  v_minimum_ac numeric := 0;
  v_minimum_cotas numeric := 0;
  v_user_record record;
  v_ranking_key text;
  v_user_data jsonb;
  v_score numeric;
  v_objective_score numeric;
  v_subjective_total numeric;
  v_reservation_type text;
  v_below_minimum boolean;
  v_below_minimum_saved boolean;
  v_is_quota boolean;
  v_applicable_minimum numeric;
BEGIN
  -- Buscar o concurso CNU - Analista Administrativo
  SELECT id, 
         (disciplines->>'minimum_total_score')::numeric,
         (disciplines->>'minimum_total_score_cotas')::numeric
  INTO v_concurso_id, v_minimum_ac, v_minimum_cotas
  FROM concursos
  WHERE titulo LIKE '%CNU%' 
    AND orgao LIKE '%Analista Administrativo%'
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF v_concurso_id IS NULL THEN
    RAISE NOTICE 'Concurso CNU - Analista Administrativo não encontrado';
    RETURN;
  END IF;
  
  RAISE NOTICE 'Concurso encontrado: %', v_concurso_id;
  RAISE NOTICE 'Mínimo AC: %, Mínimo Cotas: %', v_minimum_ac, v_minimum_cotas;
  
  -- Verificar usuários com scores baixos
  FOR v_user_record IN
    SELECT 
      ur.user_id,
      ur.consolidated_data
    FROM user_rankings ur
    WHERE ur.consolidated_data IS NOT NULL
      AND ur.consolidated_data != '{}'::jsonb
      AND ur.consolidated_data ? 'rankings'
  LOOP
    -- Buscar ranking deste concurso
    FOR v_ranking_key IN 
      SELECT jsonb_object_keys(v_user_record.consolidated_data->'rankings')
    LOOP
      v_user_data := v_user_record.consolidated_data->'rankings'->v_ranking_key;
      
      -- Verificar se é deste concurso
      IF (v_user_data->>'concurso_id')::uuid = v_concurso_id THEN
        v_score := COALESCE((v_user_data->'user_data'->>'score')::numeric, 0);
        v_reservation_type := COALESCE(v_user_data->'user_data'->>'reservation_type', 'Ampla Concorrência');
        v_below_minimum_saved := COALESCE((v_user_data->'user_data'->>'below_minimum')::boolean, false);
        
        -- Calcular score objetivo (subtrair subjetivas)
        v_subjective_total := 
          COALESCE((v_user_data->'user_data'->'subjectives'->>'discursive')::numeric, 0) +
          COALESCE((v_user_data->'user_data'->'subjectives'->>'case_study_1')::numeric, 0) +
          COALESCE((v_user_data->'user_data'->'subjectives'->>'case_study_2')::numeric, 0) +
          COALESCE((v_user_data->'user_data'->'subjectives'->>'case_study_3')::numeric, 0) +
          COALESCE((v_user_data->'user_data'->'subjectives'->>'other_subjective')::numeric, 0);
        
        v_objective_score := v_score - v_subjective_total;
        
        -- Determinar mínimo aplicável
        v_is_quota := (v_reservation_type IS NOT NULL AND v_reservation_type != 'Ampla Concorrência');
        v_applicable_minimum := CASE WHEN v_is_quota THEN v_minimum_cotas ELSE v_minimum_ac END;
        
        -- Verificar se deveria estar eliminado
        v_below_minimum := (v_applicable_minimum > 0 AND v_objective_score < v_applicable_minimum);
        
        -- Mostrar apenas usuários com problema (score baixo mas não eliminado)
        IF v_objective_score < 100 AND v_objective_score > 0 AND NOT v_below_minimum THEN
          RAISE NOTICE '⚠️ PROBLEMA DETECTADO:';
          RAISE NOTICE '  User ID: %', v_user_record.user_id;
          RAISE NOTICE '  Ranking Key: %', v_ranking_key;
          RAISE NOTICE '  Score Total: %', v_score;
          RAISE NOTICE '  Score Objetivo: %', v_objective_score;
          RAISE NOTICE '  Subjetivas: %', v_subjective_total;
          RAISE NOTICE '  Reservation Type: %', v_reservation_type;
          RAISE NOTICE '  Mínimo Aplicável: %', v_applicable_minimum;
          RAISE NOTICE '  Deveria estar eliminado: %', v_below_minimum;
          RAISE NOTICE '  Flag below_minimum salvo: %', v_below_minimum_saved;
          RAISE NOTICE '  ---';
        END IF;
        
        -- Mostrar também usuários que estão eliminados mas não deveriam estar
        IF v_below_minimum_saved AND NOT v_below_minimum AND v_objective_score >= v_applicable_minimum THEN
          RAISE NOTICE '⚠️ FALSO POSITIVO:';
          RAISE NOTICE '  User ID: %', v_user_record.user_id;
          RAISE NOTICE '  Score Objetivo: %', v_objective_score;
          RAISE NOTICE '  Mínimo Aplicável: %', v_applicable_minimum;
          RAISE NOTICE '  Flag below_minimum salvo: %', v_below_minimum_saved;
          RAISE NOTICE '  ---';
        END IF;
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- 3. Verificar estrutura de dados de um usuário específico (exemplo)
-- Substituir o user_id e ranking_key pelos valores reais
/*
SELECT 
  user_id,
  consolidated_data->'rankings'->'[ranking_key]'->'user_data'->>'score' as score_total,
  consolidated_data->'rankings'->'[ranking_key]'->'user_data'->>'below_minimum' as below_minimum,
  consolidated_data->'rankings'->'[ranking_key]'->'user_data'->>'reservation_type' as reservation_type,
  consolidated_data->'rankings'->'[ranking_key]'->'user_data'->'subjectives' as subjectives
FROM user_rankings
WHERE user_id = '[user_id]'
LIMIT 1;
*/





