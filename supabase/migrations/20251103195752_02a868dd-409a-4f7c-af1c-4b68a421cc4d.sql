-- ============================================================================
-- CORREÇÃO: Verificar e corrigir lógica de mínimos por bloco, disciplina e subjetivas
-- ============================================================================
-- PROBLEMA IDENTIFICADO:
--   Os mínimos por bloco, disciplina e subjetivas não estão funcionando
--   Precisamos adicionar debug e verificar se a lógica está correta
-- ============================================================================

-- Verificar estrutura da tabela concursos
DO $$
DECLARE
  v_sample_concurso RECORD;
  v_sample_disciplines jsonb;
BEGIN
  -- Pegar um exemplo de concurso para debug
  SELECT id, disciplines INTO v_sample_concurso
  FROM concursos
  WHERE disciplines IS NOT NULL
  LIMIT 1;
  
  IF v_sample_concurso.id IS NOT NULL THEN
    RAISE NOTICE 'Sample concurso ID: %', v_sample_concurso.id;
    RAISE NOTICE 'Disciplines structure: %', v_sample_concurso.disciplines;
    
    -- Verificar se tem minimum_total_score
    IF v_sample_concurso.disciplines ? 'minimum_total_score' THEN
      RAISE NOTICE 'Has minimum_total_score: %', v_sample_concurso.disciplines->>'minimum_total_score';
    ELSE
      RAISE WARNING 'Missing minimum_total_score in disciplines structure';
    END IF;
    
    -- Verificar se tem blocks
    IF v_sample_concurso.disciplines ? 'blocks' THEN
      RAISE NOTICE 'Number of blocks: %', jsonb_array_length(v_sample_concurso.disciplines->'blocks');
      
      -- Verificar primeiro bloco
      IF jsonb_array_length(v_sample_concurso.disciplines->'blocks') > 0 THEN
        DECLARE
          v_first_block jsonb;
        BEGIN
          v_first_block := v_sample_concurso.disciplines->'blocks'->0;
          RAISE NOTICE 'First block: %', v_first_block;
          
          -- Verificar campos do bloco
          RAISE NOTICE 'Block has blockMinimumScore: %', (v_first_block ? 'blockMinimumScore');
          RAISE NOTICE 'Block has blockMinimumCotas: %', (v_first_block ? 'blockMinimumCotas');
          
          -- Verificar disciplinas do bloco
          IF v_first_block ? 'disciplines' THEN
            RAISE NOTICE 'Number of disciplines in first block: %', jsonb_array_length(v_first_block->'disciplines');
            
            IF jsonb_array_length(v_first_block->'disciplines') > 0 THEN
              DECLARE
                v_first_discipline jsonb;
              BEGIN
                v_first_discipline := v_first_block->'disciplines'->0;
                RAISE NOTICE 'First discipline: %', v_first_discipline;
                RAISE NOTICE 'Discipline has minimum_score: %', (v_first_discipline ? 'minimum_score');
                RAISE NOTICE 'Discipline has minimum_score_cotas: %', (v_first_discipline ? 'minimum_score_cotas');
              END;
            END IF;
          END IF;
        END;
      END IF;
    ELSE
      RAISE WARNING 'Missing blocks array in disciplines structure';
    END IF;
  ELSE
    RAISE WARNING 'No concurso found with disciplines structure';
  END IF;
END $$;

-- Verificar estrutura da tabela user_rankings
DO $$
DECLARE
  v_sample_ranking RECORD;
BEGIN
  -- Pegar um exemplo de ranking para debug
  SELECT user_id, consolidated_data INTO v_sample_ranking
  FROM user_rankings
  WHERE consolidated_data IS NOT NULL
  LIMIT 1;
  
  IF v_sample_ranking.user_id IS NOT NULL THEN
    RAISE NOTICE 'Sample ranking user_id: %', v_sample_ranking.user_id;
    
    -- Verificar se tem rankings
    IF v_sample_ranking.consolidated_data ? 'rankings' THEN
      DECLARE
        v_ranking_keys text[];
        v_first_ranking_key text;
        v_first_ranking jsonb;
      BEGIN
        -- Pegar a primeira chave de ranking
        SELECT array_agg(key) INTO v_ranking_keys
        FROM jsonb_object_keys(v_sample_ranking.consolidated_data->'rankings') AS key
        LIMIT 1;
        
        IF array_length(v_ranking_keys, 1) > 0 THEN
          v_first_ranking_key := v_ranking_keys[1];
          v_first_ranking := v_sample_ranking.consolidated_data->'rankings'->v_first_ranking_key;
          
          RAISE NOTICE 'First ranking key: %', v_first_ranking_key;
          RAISE NOTICE 'First ranking structure: %', v_first_ranking;
          
          -- Verificar user_data
          IF v_first_ranking ? 'user_data' THEN
            RAISE NOTICE 'Has user_data';
            RAISE NOTICE 'Score: %', v_first_ranking->'user_data'->>'score';
            RAISE NOTICE 'below_minimum: %', v_first_ranking->'user_data'->>'below_minimum';
            RAISE NOTICE 'belowDisciplineMinimums: %', v_first_ranking->'user_data'->'belowDisciplineMinimums';
            RAISE NOTICE 'belowBlockMinimums: %', v_first_ranking->'user_data'->'belowBlockMinimums';
            RAISE NOTICE 'status: %', v_first_ranking->'user_data'->>'status';
          END IF;
        END IF;
      END;
    END IF;
  ELSE
    RAISE WARNING 'No user_ranking found';
  END IF;
END $$;

-- Log de conclusão
SELECT 'Debug concluído! Verifique os logs acima para identificar problemas na estrutura de dados.' AS status;