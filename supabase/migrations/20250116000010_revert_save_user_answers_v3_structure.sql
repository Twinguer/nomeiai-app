-- Revert save_user_answers_v3 function to work with existing JSONB structure
-- Keep the existing structure and just fix the multiple records issue

CREATE OR REPLACE FUNCTION save_user_answers_v3(
    p_ranking_id TEXT,
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
    v_consolidated_data JSONB;
    v_ranking_data JSONB;
    v_updated_ranking_data JSONB;
    v_updated_consolidated_data JSONB;
    v_edit_count INTEGER;
    v_result JSONB;
BEGIN
    -- Log início
    RAISE NOTICE 'Starting save_user_answers_v3 for ranking %', p_ranking_id;
    
    -- Get current user
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'User not authenticated');
    END IF;
    
    -- Try to find existing user_rankings record with consolidated_data
    -- Use LIMIT 1 to handle multiple records gracefully
    SELECT consolidated_data
    INTO v_consolidated_data
    FROM user_rankings 
    WHERE user_id = v_user_id
    AND consolidated_data IS NOT NULL
    AND consolidated_data != '{}'::jsonb
    ORDER BY created_at DESC
    LIMIT 1;
    
    -- If no existing record found, return error (don't create new structure)
    IF v_consolidated_data IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'User ranking data not found');
    END IF;
    
    -- Get specific ranking data from existing structure
    v_ranking_data := v_consolidated_data->'rankings'->p_ranking_id;
    IF v_ranking_data IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Ranking not found in consolidated data');
    END IF;
    
    -- Get current edit count and increment
    v_edit_count := COALESCE((v_ranking_data->'user_data'->>'edit_count')::integer, 0) + 1;
    
    -- Update existing ranking data with new answers and scores
    v_updated_ranking_data := jsonb_set(
        jsonb_set(
            jsonb_set(
                v_ranking_data,
                ARRAY['user_data', 'answers'],
                p_answers
            ),
            ARRAY['user_data', 'subjective_scores'],
            p_subjective_scores
        ),
        ARRAY['user_data', 'edit_count'],
        to_jsonb(v_edit_count)
    );
    
    -- Update selected_booklet_id if provided
    v_updated_ranking_data := jsonb_set(
        v_updated_ranking_data,
        ARRAY['selected_booklet_id'],
        to_jsonb(p_booklet_id)
    );
    
    -- Update last_updated timestamp
    v_updated_ranking_data := jsonb_set(
        v_updated_ranking_data,
        ARRAY['control_metadata', 'last_updated'],
        to_jsonb(now())
    );
    
    -- Update consolidated data
    v_updated_consolidated_data := jsonb_set(
        v_consolidated_data,
        ARRAY['rankings', p_ranking_id],
        v_updated_ranking_data
    );
    
    -- Save to database
    UPDATE user_rankings
    SET consolidated_data = v_updated_consolidated_data
    WHERE id = v_existing_record_id;
    
    -- Calculate score using the updated function
    PERFORM calculate_user_score_realtime(
        p_ranking_id,
        v_user_id,
        p_concurso_id,
        p_booklet_id
    );
    
    -- Prepare result
    v_result := jsonb_build_object(
        'success', true,
        'edit_count', v_edit_count,
        'answers_saved', jsonb_object_keys(p_answers),
        'answers_count', jsonb_array_length(jsonb_object_keys(p_answers)),
        'message', 'Respostas salvas com sucesso'
    );
    
    RAISE NOTICE 'Successfully saved answers for ranking % (edit_count: %)', p_ranking_id, v_edit_count;
    
    RETURN v_result;
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error in save_user_answers_v3: %', SQLERRM;
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM,
            'message', 'Erro ao salvar respostas'
        );
END;
$$;

-- Update function comment
COMMENT ON FUNCTION save_user_answers_v3 IS 'Salva respostas na estrutura JSONB existente (v3 - corrigida para lidar com múltiplos registros sem alterar estrutura)';
