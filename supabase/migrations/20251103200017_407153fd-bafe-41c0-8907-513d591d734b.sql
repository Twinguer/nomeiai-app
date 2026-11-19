-- ============================================================================
-- CORREÇÃO: Forçar recálculo de todos os scores para aplicar verificação de mínimos
-- ============================================================================
-- PROBLEMA: A maioria dos user_rankings não tem below_minimum, status, etc preenchidos
-- SOLUÇÃO: Recalcular todos os scores usando a função calculate_user_score_realtime
-- ============================================================================

-- Função para recalcular TODOS os rankings (forçar atualização)
DO $$
DECLARE
  v_concurso RECORD;
  v_result jsonb;
  v_total_concursos integer := 0;
  v_processed integer := 0;
BEGIN
  -- Contar concursos a processar
  SELECT COUNT(*) INTO v_total_concursos
  FROM concursos
  WHERE official_answers IS NOT NULL
    AND disciplines IS NOT NULL;
    
  RAISE NOTICE 'Iniciando recálculo para % concursos...', v_total_concursos;
  
  -- Para cada concurso que tem gabarito oficial e disciplinas
  FOR v_concurso IN
    SELECT id, titulo
    FROM concursos
    WHERE official_answers IS NOT NULL
      AND disciplines IS NOT NULL
    ORDER BY created_at DESC
  LOOP
    BEGIN
      RAISE NOTICE 'Processando concurso: % (ID: %)', v_concurso.titulo, v_concurso.id;
      
      -- Chamar a função de recálculo para este concurso
      v_result := public.recalculate_all_scores_with_weights(v_concurso.id);
      
      v_processed := v_processed + 1;
      
      -- Log do resultado
      IF (v_result->>'success')::boolean THEN
        RAISE NOTICE 'Concurso % processado com sucesso. Atualizados: %', 
          v_concurso.titulo, 
          v_result->>'updatedCount';
      ELSE
        RAISE WARNING 'Erro ao processar concurso %: %', 
          v_concurso.titulo, 
          v_result->>'message';
      END IF;
      
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Erro ao processar concurso % (ID: %): %', 
        v_concurso.titulo, 
        v_concurso.id, 
        SQLERRM;
    END;
  END LOOP;
  
  RAISE NOTICE 'Recálculo concluído! Processados: %/%', v_processed, v_total_concursos;
END $$;

-- Verificar resultados
SELECT 
  COUNT(*) as total_rankings,
  COUNT(CASE WHEN ranking_data->'user_data'->>'status' IS NOT NULL THEN 1 END) as com_status,
  COUNT(CASE WHEN ranking_data->'user_data'->>'status' = 'eliminado' THEN 1 END) as eliminados,
  COUNT(CASE WHEN ranking_data->'user_data'->>'status' = 'classificado' THEN 1 END) as classificados,
  COUNT(CASE WHEN (ranking_data->'user_data'->>'below_minimum')::boolean = true THEN 1 END) as abaixo_minimo
FROM user_rankings,
  jsonb_each(consolidated_data->'rankings') as ranking_entry(ranking_key, ranking_data)
WHERE consolidated_data ? 'rankings';