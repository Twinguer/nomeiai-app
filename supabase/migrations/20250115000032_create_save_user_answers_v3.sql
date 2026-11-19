-- =====================================================
-- MIGRATION: Criar função save_user_answers_v3 com estrutura consolidada
-- OBJETIVO: Nova função RPC para salvar respostas na estrutura consolidada por usuário
-- DATA: 2025-01-15
-- =====================================================

-- 1. Criar função save_user_answers_v3
-- =====================================================
CREATE OR REPLACE FUNCTION save_user_answers_v3(
    p_ranking_id UUID,
    p_concurso_id UUID,
    p_booklet_id TEXT,
    p_answers JSONB,
    p_subjective_scores JSONB DEFAULT '{}'::jsonb,
    p_current_edit_count INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_concurso_key TEXT;
    v_consolidated_data JSONB;
    v_subjective_data JSONB;
    v_edit_count INTEGER;
    v_answers_data JSONB;
    v_metadata JSONB;
    v_result JSONB;
BEGIN
    -- Log início
    RAISE NOTICE 'Starting save_user_answers_v3 for ranking %', p_ranking_id;
    
    -- Obter dados do usuário
    SELECT user_id, edit_count
    INTO v_user_id, v_edit_count
    FROM user_rankings 
    WHERE id = p_ranking_id;
    
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Ranking não encontrado');
    END IF;
    
    v_concurso_key := p_concurso_id::text;
    v_edit_count := COALESCE(v_edit_count, 0) + 1;
    
    -- Buscar dados existentes
    SELECT 
        COALESCE(consolidated_data, '{}'::jsonb),
        COALESCE(subjective_scores, '{}'::jsonb)
    INTO v_consolidated_data, v_subjective_data
    FROM user_rankings 
    WHERE id = p_ranking_id;
    
    -- Preparar dados de respostas para o caderno específico
    v_answers_data := jsonb_build_object(
        'answers', p_answers,
        'metadata', jsonb_build_object(
            'booklet_id', p_booklet_id,
            'saved_at', now(),
            'edit_count', v_edit_count
        )
    );
    
    -- Atualizar respostas do concurso específico
    v_consolidated_data := jsonb_set(
        v_consolidated_data,
        ARRAY[v_concurso_key, 'answers', p_booklet_id],
        p_answers
    );
    
    -- Atualizar metadados do concurso
    v_metadata := jsonb_build_object(
        'last_updated', now(),
        'total_edit_count', v_edit_count,
        'selected_booklet', p_booklet_id,
        'version', '3.0'
    );
    
    v_consolidated_data := jsonb_set(
        v_consolidated_data,
        ARRAY[v_concurso_key, 'metadata'],
        v_metadata
    );
    
    -- Atualizar pontuações subjetivas do concurso específico
    v_subjective_data := jsonb_set(
        v_subjective_data,
        ARRAY[v_concurso_key],
        p_subjective_scores
    );
    
    -- Salvar dados consolidados
    UPDATE user_rankings 
    SET 
        consolidated_data = v_consolidated_data,
        subjective_scores = v_subjective_data,
        edit_count = v_edit_count,
        updated_at = now()
    WHERE id = p_ranking_id;
    
    -- Preparar resultado
    v_result := jsonb_build_object(
        'success', true,
        'message', 'Respostas salvas com sucesso na estrutura consolidada',
        'edit_count', v_edit_count,
        'booklet_id', p_booklet_id,
        'answers_saved', jsonb_array_length(jsonb_object_keys(p_answers)),
        'concurso_id', p_concurso_id,
        'subjective_scores', p_subjective_scores
    );
    
    RAISE NOTICE 'Successfully saved answers for ranking % in consolidated structure', p_ranking_id;
    
    RETURN v_result;
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error in save_user_answers_v3: %', SQLERRM;
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM,
            'message', 'Erro ao salvar respostas na estrutura consolidada'
        );
END;
$$;

-- 2. Criar função para buscar respostas consolidadas
-- =====================================================
CREATE OR REPLACE FUNCTION get_user_consolidated_answers(
    p_ranking_id UUID,
    p_concurso_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_consolidated_data JSONB;
    v_subjective_data JSONB;
    v_concurso_key TEXT;
    v_result JSONB;
BEGIN
    -- Buscar dados consolidados
    SELECT 
        COALESCE(consolidated_data, '{}'::jsonb),
        COALESCE(subjective_scores, '{}'::jsonb)
    INTO v_consolidated_data, v_subjective_data
    FROM user_rankings 
    WHERE id = p_ranking_id;
    
    -- Se especificou concurso, retornar apenas dados desse concurso
    IF p_concurso_id IS NOT NULL THEN
        v_concurso_key := p_concurso_id::text;
        v_result := jsonb_build_object(
            'concurso_id', p_concurso_id,
            'answers', v_consolidated_data->v_concurso_key->'answers',
            'subjective_scores', v_subjective_data->v_concurso_key,
            'metadata', v_consolidated_data->v_concurso_key->'metadata'
        );
    ELSE
        -- Retornar todos os dados consolidados
        v_result := jsonb_build_object(
            'consolidated_data', v_consolidated_data,
            'subjective_scores', v_subjective_data
        );
    END IF;
    
    RETURN v_result;
END;
$$;

-- 3. Criar função para buscar respostas de um caderno específico
-- =====================================================
CREATE OR REPLACE FUNCTION get_user_answers_for_booklet(
    p_ranking_id UUID,
    p_concurso_id UUID,
    p_booklet_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_consolidated_data JSONB;
    v_concurso_key TEXT;
    v_answers JSONB;
BEGIN
    v_concurso_key := p_concurso_id::text;
    
    -- Buscar dados consolidados
    SELECT consolidated_data
    INTO v_consolidated_data
    FROM user_rankings 
    WHERE id = p_ranking_id;
    
    -- Extrair respostas do caderno específico
    v_answers := v_consolidated_data->v_concurso_key->'answers'->p_booklet_id;
    
    RETURN COALESCE(v_answers, '{}'::jsonb);
END;
$$;

-- 4. Comentários das funções
-- =====================================================
COMMENT ON FUNCTION save_user_answers_v3 IS 'Salva respostas na estrutura consolidada por usuário e concurso';
COMMENT ON FUNCTION get_user_consolidated_answers IS 'Busca respostas consolidadas de um usuário';
COMMENT ON FUNCTION get_user_answers_for_booklet IS 'Busca respostas de um caderno específico';
