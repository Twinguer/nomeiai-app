-- Fix save_user_answers_v3 function to handle multiple user_rankings records properly
-- The function should work with the JSONB structure where each user can have multiple records
-- but we need to find the correct one or create a new one if needed

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
    v_existing_record_id UUID;
    v_has_existing_data BOOLEAN := false;
BEGIN
    -- Log início
    RAISE NOTICE 'Starting save_user_answers_v3 for ranking %', p_ranking_id;
    
    -- Get current user
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'User not authenticated');
    END IF;
    
    -- Try to find existing user_rankings record with consolidated_data
    SELECT id, consolidated_data
    INTO v_existing_record_id, v_consolidated_data
    FROM user_rankings 
    WHERE user_id = v_user_id
    AND consolidated_data IS NOT NULL
    AND consolidated_data != '{}'::jsonb
    ORDER BY created_at DESC
    LIMIT 1;
    
    -- If no existing record found, create a new one
    IF v_existing_record_id IS NULL THEN
        RAISE NOTICE 'No existing user_rankings record found, creating new one for user %', v_user_id;
        
        -- Create new consolidated_data structure
        v_consolidated_data := jsonb_build_object(
            'rankings', jsonb_build_object(),
            'metadata', jsonb_build_object(
                'created_at', now(),
                'last_updated', now(),
                'version', '1.0'
            )
        );
        
        -- Insert new record
        INSERT INTO user_rankings (user_id, consolidated_data)
        VALUES (v_user_id, v_consolidated_data)
        RETURNING id INTO v_existing_record_id;
        
        RAISE NOTICE 'Created new user_rankings record with id %', v_existing_record_id;
    ELSE
        v_has_existing_data := true;
        RAISE NOTICE 'Found existing user_rankings record with id %', v_existing_record_id;
    END IF;
    
    -- Ensure consolidated_data has the rankings structure
    IF NOT (v_consolidated_data ? 'rankings') THEN
        v_consolidated_data := jsonb_set(
            v_consolidated_data,
            ARRAY['rankings'],
            jsonb_build_object()
        );
    END IF;
    
    -- Get specific ranking data
    v_ranking_data := v_consolidated_data->'rankings'->p_ranking_id;
    
    -- If ranking doesn't exist, create it
    IF v_ranking_data IS NULL THEN
        RAISE NOTICE 'Ranking % not found, creating new ranking data', p_ranking_id;
        
        v_ranking_data := jsonb_build_object(
            'concurso_id', p_concurso_id,
            'selected_booklet_id', p_booklet_id,
            'user_data', jsonb_build_object(
                'score', 0,
                'edit_count', 0,
                'all_questions_answered', false,
                'answers', p_answers,
                'subjective_scores', p_subjective_scores
            ),
            'control_metadata', jsonb_build_object(
                'is_score_recalculated', false,
                'edit_history', jsonb_build_array(),
                'last_updated', now(),
                'created_at', now()
            )
        );
        
        v_edit_count := 1;
    ELSE
        -- Get current edit count and increment
        v_edit_count := COALESCE((v_ranking_data->'user_data'->>'edit_count')::integer, 0) + 1;
        
        -- Update existing ranking data with new answers and scores
        v_ranking_data := jsonb_set(
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
        v_ranking_data := jsonb_set(
            v_ranking_data,
            ARRAY['selected_booklet_id'],
            to_jsonb(p_booklet_id)
        );
    END IF;
    
    -- Update last_updated timestamp
    v_ranking_data := jsonb_set(
        v_ranking_data,
        ARRAY['control_metadata', 'last_updated'],
        to_jsonb(now())
    );
    
    -- Update consolidated data
    v_updated_consolidated_data := jsonb_set(
        v_consolidated_data,
        ARRAY['rankings', p_ranking_id],
        v_ranking_data
    );
    
    -- Update metadata
    v_updated_consolidated_data := jsonb_set(
        v_updated_consolidated_data,
        ARRAY['metadata', 'last_updated'],
        to_jsonb(now())
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
        'message', 'Respostas salvas com sucesso',
        'ranking_created', v_ranking_data IS NULL
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
COMMENT ON FUNCTION save_user_answers_v3 IS 'Salva respostas na estrutura JSONB consolidada por usuário (v3 - corrigida para lidar com múltiplos registros)';












