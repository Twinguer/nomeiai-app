-- ====================================================================
-- Migration: Adicionar recálculo automático após salvar gabarito oficial
-- ====================================================================
-- Atualiza função save_consolidated_answer_key para SEMPRE recalcular
-- todos os participantes após edição do gabarito oficial.
-- Com tratamento de erros robusto e timeout de segurança.
-- ====================================================================

CREATE OR REPLACE FUNCTION public.save_consolidated_answer_key(
    p_concurso_id uuid,
    p_booklet_id text,
    p_answers jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    v_existing_data JSONB;
    v_consolidated_data JSONB;
    v_booklet_answers JSONB := '{}';
    v_question_key TEXT;
    v_answer_data JSONB;
    v_answer_count INTEGER := 0;
    v_recalc_result JSONB;
BEGIN
    RAISE NOTICE 'Starting save_consolidated_answer_key for concurso % booklet %', p_concurso_id, p_booklet_id;
    
    -- Buscar dados existentes do campo official_answers da tabela concursos
    SELECT COALESCE(official_answers, '{}'::jsonb)
    INTO v_existing_data
    FROM concursos
    WHERE id = p_concurso_id;
    
    -- Se não encontrar o concurso, retornar erro
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Concurso % not found', p_concurso_id;
    END IF;
    
    RAISE NOTICE 'Processing % answers for booklet %', jsonb_typeof(p_answers), p_booklet_id;
    
    -- Construir objeto de respostas do caderno
    FOR v_question_key, v_answer_data IN SELECT * FROM jsonb_each(p_answers)
    LOOP
        v_booklet_answers := jsonb_set(
            v_booklet_answers,
            ARRAY[v_question_key],
            v_answer_data
        );
        v_answer_count := v_answer_count + 1;
    END LOOP;
    
    RAISE NOTICE 'Processed % answers for booklet %', v_answer_count, p_booklet_id;
    
    -- Atualizar o caderno específico na estrutura consolidada
    v_consolidated_data := jsonb_set(
        v_existing_data,
        ARRAY[p_booklet_id],
        jsonb_build_object(
            'questions', v_booklet_answers,
            'metadata', jsonb_build_object(
                'total_questions', v_answer_count,
                'last_updated', now(),
                'booklet_name', p_booklet_id
            )
        )
    );
    
    -- Atualizar o campo official_answers na tabela concursos
    UPDATE concursos 
    SET 
        official_answers = v_consolidated_data,
        updated_at = now()
    WHERE id = p_concurso_id;
    
    RAISE NOTICE 'Successfully saved consolidated answer key for concurso % booklet %', p_concurso_id, p_booklet_id;
    
    -- ⚠️ RECÁLCULO AUTOMÁTICO DESATIVADO TEMPORARIAMENTE
    -- A função recalculate_all_scores_with_weights usa lógica simplificada (antiga)
    -- que NÃO considera penalidades de "Certo ou Errado" nem pesos por disciplina.
    -- Isso sobrescreve scores corretos calculados pelo frontend TypeScript.
    -- TODO: Atualizar função SQL para ter paridade com lógica TypeScript antes de reativar.
    
    /*
    -- ❌ CÓDIGO COMENTADO (CAUSA SCORES ERRADOS)
    BEGIN
        RAISE NOTICE 'Starting automatic score recalculation for concurso %', p_concurso_id;
        
        SET LOCAL statement_timeout = '60s';
        
        SELECT recalculate_all_scores_with_weights(p_concurso_id)
        INTO v_recalc_result;
        
        RESET statement_timeout;
        
        IF (v_recalc_result->>'success')::boolean THEN
            RAISE NOTICE 'Score recalculation completed successfully: % users updated', 
                         COALESCE((v_recalc_result->>'updatedCount')::integer, 0);
        ELSE
            RAISE WARNING 'Score recalculation failed: %', v_recalc_result->>'message';
        END IF;
        
    EXCEPTION
        WHEN OTHERS THEN
            RAISE WARNING 'Error during automatic recalculation (non-fatal): %', SQLERRM;
            RAISE NOTICE 'Answer key was saved successfully despite recalculation error';
    END;
    */
    
    -- Retornar sucesso (gabarito salvo, sem recálculo automático)
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Gabarito salvo com sucesso.',
        'booklet_id', p_booklet_id,
        'answers_saved', v_answer_count
    );
    
EXCEPTION
    WHEN OTHERS THEN
        -- Erro crítico no salvamento do gabarito
        RAISE NOTICE 'CRITICAL ERROR in save_consolidated_answer_key: %', SQLERRM;
        RETURN jsonb_build_object(
            'success', false,
            'message', SQLERRM,
            'booklet_id', p_booklet_id,
            'answers_saved', 0
        );
END;
$function$;

-- Atualizar comentário da função
COMMENT ON FUNCTION save_consolidated_answer_key IS 
'Salva gabarito oficial consolidado por caderno. 
NOTA: Recálculo automático está desativado para evitar sobrescrever scores calculados corretamente pelo frontend.';

-- Adicionar índice para otimizar o recálculo (se não existir)
CREATE INDEX IF NOT EXISTS idx_user_rankings_consolidated_data_concurso 
ON user_rankings USING gin ((consolidated_data->'rankings'));

-- Log da migration
DO $$
BEGIN
    RAISE NOTICE '✅ Migration completed: save_consolidated_answer_key updated';
    RAISE NOTICE '⚠️ Auto-recalculation is DISABLED to prevent overwriting correct scores';
    RAISE NOTICE '📝 TODO: Update recalculate_all_scores_with_weights to match frontend logic before re-enabling';
END $$;

