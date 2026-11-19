-- Fix the save_user_answers_with_booklet function to correctly populate the booklets structure
CREATE OR REPLACE FUNCTION save_user_answers_with_booklet(
  p_ranking_id UUID,
  p_concurso_id UUID,
  p_booklet_id TEXT,
  p_answers JSONB,
  p_discursive_score NUMERIC DEFAULT 0,
  p_case_study_1_score NUMERIC DEFAULT 0,
  p_case_study_2_score NUMERIC DEFAULT 0,
  p_case_study_3_score NUMERIC DEFAULT 0,
  p_current_edit_count INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_existing_data JSONB;
  v_answer_obj JSONB;
  v_question_num TEXT;
  v_answer_value TEXT;
  v_booklet_answers JSONB := '{}';
  v_consolidated_data JSONB;
  v_saved_answers JSONB := '{}';
  v_answer_count INTEGER := 0;
  v_edit_count INTEGER;
BEGIN
  -- Log function start
  RAISE NOTICE 'save_user_answers_with_booklet: Starting for ranking_id=%, booklet_id=%, answers_count=%', 
    p_ranking_id, p_booklet_id, jsonb_array_length(p_answers);

  -- Get existing consolidated data
  SELECT answers_data INTO v_existing_data
  FROM user_answers
  WHERE user_ranking_id = p_ranking_id AND question_number IS NULL;

  -- Initialize consolidated data structure if it doesn't exist
  IF v_existing_data IS NULL THEN
    v_existing_data := jsonb_build_object(
      'booklets', '{}',
      'subjective_scores', jsonb_build_object(
        'discursive', 0,
        'case_study_1', 0,
        'case_study_2', 0,
        'case_study_3', 0
      ),
      'selected_booklet', p_booklet_id,
      'total_edit_count', 0,
      'metadata', jsonb_build_object(
        'last_updated', NOW(),
        'version', '2.0'
      )
    );
  END IF;

  -- Process each answer and build the booklet answers object
  FOR v_answer_obj IN SELECT * FROM jsonb_array_elements(p_answers)
  LOOP
    v_question_num := (v_answer_obj->>'questionNumber')::TEXT;
    v_answer_value := v_answer_obj->>'answer';
    
    -- Add answer to booklet answers
    v_booklet_answers := jsonb_set(
      v_booklet_answers,
      ARRAY[v_question_num],
      to_jsonb(v_answer_value)
    );
    
    -- Add to saved answers for response
    v_saved_answers := jsonb_set(
      v_saved_answers,
      ARRAY[v_question_num],
      to_jsonb(v_answer_value)
    );
    
    v_answer_count := v_answer_count + 1;
  END LOOP;

  -- Calculate new edit count
  v_edit_count := COALESCE((v_existing_data->>'total_edit_count')::INTEGER, 0) + 1;

  -- Build the updated consolidated data with the booklet answers
  v_consolidated_data := jsonb_set(
    v_existing_data,
    ARRAY['booklets', p_booklet_id],
    jsonb_build_object(
      'answers', v_booklet_answers,
      'metadata', jsonb_build_object(
        'completed_at', NOW(),
        'answer_count', v_answer_count,
        'booklet_name', p_booklet_id
      )
    )
  );

  -- Update subjective scores
  v_consolidated_data := jsonb_set(
    v_consolidated_data,
    ARRAY['subjective_scores'],
    jsonb_build_object(
      'discursive', p_discursive_score,
      'case_study_1', p_case_study_1_score,
      'case_study_2', p_case_study_2_score,
      'case_study_3', p_case_study_3_score
    )
  );

  -- Update metadata
  v_consolidated_data := jsonb_set(
    v_consolidated_data,
    ARRAY['selected_booklet'],
    to_jsonb(p_booklet_id)
  );

  v_consolidated_data := jsonb_set(
    v_consolidated_data,
    ARRAY['total_edit_count'],
    to_jsonb(v_edit_count)
  );

  v_consolidated_data := jsonb_set(
    v_consolidated_data,
    ARRAY['metadata', 'last_updated'],
    to_jsonb(NOW())
  );

  -- Log the consolidated data before saving
  RAISE NOTICE 'save_user_answers_with_booklet: Consolidated data to save: %', v_consolidated_data;

  -- Save or update the consolidated data
  INSERT INTO user_answers (
    user_ranking_id,
    question_number,
    answers_data,
    booklet_id,
    updated_at
  ) VALUES (
    p_ranking_id,
    NULL,
    v_consolidated_data,
    p_booklet_id::UUID,
    NOW()
  )
  ON CONFLICT (user_ranking_id) WHERE question_number IS NULL
  DO UPDATE SET
    answers_data = EXCLUDED.answers_data,
    booklet_id = EXCLUDED.booklet_id,
    updated_at = EXCLUDED.updated_at;

  -- Update user_rankings with subjective scores and edit count
  UPDATE user_rankings
  SET
    discursive_score = p_discursive_score,
    case_study_1_score = p_case_study_1_score,
    case_study_2_score = p_case_study_2_score,
    case_study_3_score = p_case_study_3_score,
    edit_count = v_edit_count,
    selected_booklet = p_booklet_id::UUID,
    updated_at = NOW()
  WHERE id = p_ranking_id;

  -- Log success
  RAISE NOTICE 'save_user_answers_with_booklet: Successfully saved % answers for booklet %', 
    v_answer_count, p_booklet_id;

  -- Return success response
  RETURN jsonb_build_object(
    'success', true,
    'answers_saved', v_answer_count,
    'edit_count', v_edit_count,
    'saved_answers', v_saved_answers
  );

EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'save_user_answers_with_booklet: Error - %', SQLERRM;
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;