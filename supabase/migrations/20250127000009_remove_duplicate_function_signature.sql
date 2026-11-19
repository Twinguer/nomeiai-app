-- ============================================================================
-- CORREÇÃO: Remover assinatura duplicada da função recalculate_all_scores_with_weights
-- ============================================================================
-- PROBLEMA: 
--   Existem duas versões da função: uma com p_concurso_id text e outra com uuid
--   Isso causa ambiguidade ao chamar a função via RPC (erro PGRST203)
--
-- SOLUÇÃO:
--   Remover TODAS as versões e recriar apenas a versão com uuid
-- ============================================================================

-- Remover TODAS as versões da função para resolver ambiguidade
-- Primeiro, remover especificamente a versão com text (se existir)
DROP FUNCTION IF EXISTS public.recalculate_all_scores_with_weights(p_concurso_id text) CASCADE;

-- Depois, remover a versão com uuid também (vamos recriar ela)
DROP FUNCTION IF EXISTS public.recalculate_all_scores_with_weights(p_concurso_id uuid) CASCADE;

-- Recriar APENAS a versão com uuid (a versão correta)
-- Esta é a versão que a migration 20250127000008 deveria ter criado
CREATE OR REPLACE FUNCTION public.recalculate_all_scores_with_weights(
  p_concurso_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_user_ranking_record record;
  v_ranking_key text;
  v_updated_count integer := 0;
  v_start_time timestamp;
  v_end_time timestamp;
  v_execution_time integer;
  v_official_answers jsonb;
  v_concurso_exists boolean := false;
BEGIN
  v_start_time := clock_timestamp();
  
  -- ✅ CRÍTICO: Desabilitar RLS temporariamente usando SET LOCAL
  -- Isso permite que a função veja e atualize TODOS os registros,
  -- independente das políticas RLS aplicadas. Essencial para recálculo público.
  PERFORM set_config('row_security', 'off', true);  -- true = LOCAL (apenas esta transação)
  
  -- Check if concurso exists and has official answers
  SELECT EXISTS(
    SELECT 1 FROM concursos 
    WHERE id = p_concurso_id 
    AND official_answers IS NOT NULL
  ) INTO v_concurso_exists;

  IF NOT v_concurso_exists THEN
    PERFORM set_config('row_security', 'on', true);
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Concurso not found or no official answers available',
      'updatedCount', 0,
      'executionTimeMs', 0
    );
  END IF;

  -- Get official answers structure
  SELECT official_answers INTO v_official_answers
  FROM concursos
  WHERE id = p_concurso_id;

  -- Log the operation (se tabela existir)
  -- Nota: user_ranking_id é NULL porque é um recálculo em lote (não para um ranking específico)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'score_calculation_logs') THEN
    INSERT INTO score_calculation_logs (user_ranking_id, calculation_type, calculation_details)
    VALUES (
      NULL,  -- NULL porque é recálculo em lote, não para um ranking específico
      'batch_recalculation_start',
      jsonb_build_object(
        'concurso_id', p_concurso_id,
        'available_booklets', (
          SELECT array_agg(key) 
          FROM jsonb_object_keys(v_official_answers) AS key
        ),
        'timestamp', now()
      )
    );
  END IF;

  -- ✅ Process ALL user rankings (RLS desabilitado, então vê TODOS)
  FOR v_user_ranking_record IN
    SELECT user_id, consolidated_data
    FROM user_rankings
    WHERE consolidated_data IS NOT NULL
  LOOP
    -- Check if this user has rankings for the target concurso
    IF v_user_ranking_record.consolidated_data ? 'rankings' THEN
      FOR v_ranking_key IN
        SELECT key
        FROM jsonb_object_keys(v_user_ranking_record.consolidated_data->'rankings') AS key
      LOOP
        IF (v_user_ranking_record.consolidated_data->'rankings'->v_ranking_key->>'concurso_id')::uuid = p_concurso_id THEN
          -- Recalculate score for this ranking
          -- Como RLS está desabilitado via SET LOCAL, a função chamada também
          -- terá RLS desabilitado e conseguirá fazer UPDATE em qualquer registro
          PERFORM calculate_user_score_realtime(
            v_ranking_key,
            v_user_ranking_record.user_id,
            p_concurso_id,
            v_user_ranking_record.consolidated_data->'rankings'->v_ranking_key->>'selected_booklet_id'
          );
          
          v_updated_count := v_updated_count + 1;
        END IF;
      END LOOP;
    END IF;
  END LOOP;

  v_end_time := clock_timestamp();
  v_execution_time := EXTRACT(EPOCH FROM (v_end_time - v_start_time)) * 1000;

  -- Log completion
  -- Nota: user_ranking_id é NULL porque é um recálculo em lote
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'score_calculation_logs') THEN
    INSERT INTO score_calculation_logs (user_ranking_id, calculation_type, calculation_details)
    VALUES (
      NULL,  -- NULL porque é recálculo em lote, não para um ranking específico
      'batch_recalculation_complete',
      jsonb_build_object(
        'concurso_id', p_concurso_id,
        'updated_count', v_updated_count,
        'execution_time_ms', v_execution_time,
        'timestamp', now()
      )
    );
  END IF;

  -- ✅ RLS será reabilitado automaticamente ao final da transação
  PERFORM set_config('row_security', 'on', true);

  RETURN jsonb_build_object(
    'success', true,
    'updatedCount', v_updated_count,
    'executionTimeMs', v_execution_time
  );
EXCEPTION
  WHEN OTHERS THEN
    -- ✅ CRÍTICO: Reabilitar RLS mesmo em caso de erro
    PERFORM set_config('row_security', 'on', true);
    -- Log do erro se possível
    -- Nota: user_ranking_id é NULL porque é um recálculo em lote
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'score_calculation_logs') THEN
      INSERT INTO score_calculation_logs (user_ranking_id, calculation_type, calculation_details)
      VALUES (
        NULL,  -- NULL porque é recálculo em lote, não para um ranking específico
        'batch_recalculation_error',
        jsonb_build_object(
          'concurso_id', p_concurso_id,
          'error', SQLERRM,
          'error_detail', SQLSTATE,
          'timestamp', now()
        )
      );
    END IF;
    RAISE;
END;
$function$;

-- Garantir GRANT EXECUTE na versão correta (uuid)
GRANT EXECUTE ON FUNCTION public.recalculate_all_scores_with_weights(uuid) TO anon, authenticated;

-- Verificar se apenas a versão uuid existe agora
DO $$
DECLARE
  v_func_count integer;
  v_func_signatures text;
BEGIN
  SELECT COUNT(*), string_agg(pg_get_function_arguments(p.oid), ', ')
  INTO v_func_count, v_func_signatures
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public' 
    AND p.proname = 'recalculate_all_scores_with_weights';
  
  IF v_func_count > 1 THEN
    RAISE WARNING 'Ainda existem % versões da função: %', v_func_count, v_func_signatures;
  ELSE
    RAISE NOTICE 'Função única criada com sucesso: %', COALESCE(v_func_signatures, 'nenhuma');
  END IF;
END $$;

-- Finalização
SELECT 'Correção aplicada! Versão duplicada removida. Apenas a versão com uuid (p_concurso_id uuid) permanece.' AS status;
