-- CRITICAL SECURITY FIXES - Phase 1

-- 1. Add authorization guards to SECURITY DEFINER functions
CREATE OR REPLACE FUNCTION public.save_user_answers_with_booklet(
    p_ranking_id uuid, 
    p_concurso_id uuid, 
    p_booklet_id text, 
    p_answers jsonb, 
    p_discursive_score numeric DEFAULT 0, 
    p_case_study_1_score numeric DEFAULT 0, 
    p_case_study_2_score numeric DEFAULT 0, 
    p_case_study_3_score numeric DEFAULT 0, 
    p_current_edit_count integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_user_id UUID;
    v_existing_data JSONB;
    v_consolidated_data JSONB;
    v_booklet_answers JSONB := '{}';
    v_answer RECORD;
    v_answers_saved INTEGER := 0;
    v_existing_record_id INTEGER;
BEGIN
    -- SECURITY: Verify user owns this ranking
    SELECT user_id INTO v_user_id
    FROM user_rankings
    WHERE id = p_ranking_id;
    
    IF v_user_id IS NULL OR v_user_id != auth.uid() THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized access');
    END IF;

    -- Log security check
    INSERT INTO security_logs (user_id, action, details)
    VALUES (auth.uid(), 'save_answers_attempt', jsonb_build_object(
        'ranking_id', p_ranking_id,
        'authorized', true
    ));

    -- Continue with existing logic...
    IF p_current_edit_count >= 5 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Limite de edições atingido');
    END IF;
    
    SELECT id, answers_data INTO v_existing_record_id, v_existing_data
    FROM user_answers
    WHERE user_ranking_id = p_ranking_id
    AND question_number IS NULL;
    
    IF v_existing_data IS NULL THEN
        v_existing_data := jsonb_build_object(
            'booklets', '{}',
            'subjective_scores', jsonb_build_object(
                'discursive', 0,
                'case_study_1', 0,
                'case_study_2', 0,
                'case_study_3', 0
            ),
            'selected_booklet', '',
            'total_edit_count', 0,
            'metadata', jsonb_build_object(
                'last_updated', now(),
                'version', '2.0'
            )
        );
    END IF;
    
    FOR v_answer IN
        SELECT 
            (elem->>'questionNumber')::integer as question_number,
            elem->>'answer' as answer
        FROM jsonb_array_elements(p_answers) as elem
        WHERE elem->>'questionNumber' IS NOT NULL AND elem->>'answer' IS NOT NULL
    LOOP
        v_booklet_answers := jsonb_set(
            v_booklet_answers,
            ARRAY[v_answer.question_number::text],
            to_jsonb(v_answer.answer)
        );
        v_answers_saved := v_answers_saved + 1;
    END LOOP;
    
    v_consolidated_data := v_existing_data;
    
    IF v_consolidated_data->'booklets' IS NULL THEN
        v_consolidated_data := jsonb_set(v_consolidated_data, ARRAY['booklets'], '{}');
    END IF;
    
    v_consolidated_data := jsonb_set(
        v_consolidated_data,
        ARRAY['booklets', p_booklet_id],
        jsonb_build_object(
            'answers', v_booklet_answers,
            'metadata', jsonb_build_object(
                'completed_at', now(),
                'answer_count', v_answers_saved
            )
        )
    );
    
    v_consolidated_data := jsonb_set(v_consolidated_data, ARRAY['subjective_scores'], 
        jsonb_build_object(
            'discursive', p_discursive_score,
            'case_study_1', p_case_study_1_score,
            'case_study_2', p_case_study_2_score,
            'case_study_3', p_case_study_3_score
        )
    );
    
    v_consolidated_data := jsonb_set(v_consolidated_data, ARRAY['selected_booklet'], to_jsonb(p_booklet_id));
    v_consolidated_data := jsonb_set(v_consolidated_data, ARRAY['total_edit_count'], to_jsonb(p_current_edit_count + 1));
    v_consolidated_data := jsonb_set(v_consolidated_data, ARRAY['metadata', 'last_updated'], to_jsonb(now()));
    
    IF v_existing_record_id IS NOT NULL THEN
        UPDATE user_answers 
        SET 
            answers_data = v_consolidated_data,
            answer_format = 'CONSOLIDATED',
            updated_at = now()
        WHERE id = v_existing_record_id;
    ELSE
        INSERT INTO user_answers (user_ranking_id, answers_data, answer_format, updated_at)
        VALUES (p_ranking_id, v_consolidated_data, 'CONSOLIDATED', now())
        RETURNING id INTO v_existing_record_id;
    END IF;
    
    UPDATE user_rankings
    SET 
        edit_count = p_current_edit_count + 1,
        discursive_score = p_discursive_score,
        case_study_1_score = p_case_study_1_score,
        case_study_2_score = p_case_study_2_score,
        case_study_3_score = p_case_study_3_score,
        selected_booklet = CASE 
            WHEN p_booklet_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' 
            THEN p_booklet_id::uuid 
            ELSE NULL 
        END,
        updated_at = now()
    WHERE id = p_ranking_id;
    
    PERFORM calculate_user_score_realtime(p_ranking_id);
    
    RETURN jsonb_build_object(
        'success', true, 
        'edit_count', p_current_edit_count + 1,
        'answers_saved', v_answers_saved,
        'saved_answers', v_booklet_answers
    );
END;
$function$;

-- 2. Secure switch_user_booklet function
CREATE OR REPLACE FUNCTION public.switch_user_booklet(p_ranking_id uuid, p_booklet_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_user_id UUID;
    v_ranking_owner_id UUID;
    v_concurso_id UUID;
    v_consolidated_data JSONB;
    v_booklet_answers JSONB;
    v_previous_booklet TEXT;
BEGIN
    -- SECURITY: Verify user owns this ranking
    SELECT user_id, concurso_id, selected_booklet 
    INTO v_ranking_owner_id, v_concurso_id, v_previous_booklet
    FROM user_rankings
    WHERE id = p_ranking_id;
    
    IF v_ranking_owner_id IS NULL OR v_ranking_owner_id != auth.uid() THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized access');
    END IF;

    -- Log security check
    INSERT INTO security_logs (user_id, action, details)
    VALUES (auth.uid(), 'switch_booklet_attempt', jsonb_build_object(
        'ranking_id', p_ranking_id,
        'new_booklet', p_booklet_id,
        'authorized', true
    ));
    
    SELECT consolidated_data INTO v_consolidated_data
    FROM consolidated_answers_by_concurso
    WHERE concurso_id = v_concurso_id;
    
    IF v_consolidated_data IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Dados do concurso não encontrados');
    END IF;
    
    v_consolidated_data := jsonb_set(
        v_consolidated_data,
        ARRAY['users', v_ranking_owner_id::text, 'selected_booklet'],
        to_jsonb(p_booklet_id)
    );
    
    v_consolidated_data := jsonb_set(
        v_consolidated_data,
        ARRAY['users', v_ranking_owner_id::text, 'last_updated'],
        to_jsonb(now())
    );
    
    UPDATE consolidated_answers_by_concurso
    SET 
        consolidated_data = v_consolidated_data,
        updated_at = now()
    WHERE concurso_id = v_concurso_id;
    
    UPDATE user_rankings
    SET 
        selected_booklet = CASE 
            WHEN p_booklet_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' 
            THEN p_booklet_id::uuid 
            ELSE NULL 
        END,
        updated_at = now()
    WHERE id = p_ranking_id;
    
    v_booklet_answers := v_consolidated_data->'users'->v_ranking_owner_id::text->'booklets'->p_booklet_id->'answers';
    
    PERFORM calculate_user_score_realtime(p_ranking_id);
    
    RETURN jsonb_build_object(
        'success', true,
        'booklet_id', p_booklet_id,
        'answers', COALESCE(v_booklet_answers, '{}'::jsonb),
        'message', 'Caderno alterado com sucesso'
    );
END;
$function$;

-- 3. Secure admin_delete_user_profile function
CREATE OR REPLACE FUNCTION public.admin_delete_user_profile(user_id_param uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- SECURITY: Verify user has admin role
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    INSERT INTO security_logs (user_id, action, details)
    VALUES (auth.uid(), 'unauthorized_admin_delete_attempt', jsonb_build_object(
        'target_user_id', user_id_param
    ));
    RETURN FALSE;
  END IF;

  -- Log admin action
  INSERT INTO security_logs (user_id, action, details)
  VALUES (auth.uid(), 'admin_delete_user_profile', jsonb_build_object(
      'target_user_id', user_id_param,
      'authorized', true
  ));
  
  DELETE FROM user_followers 
  WHERE follower_id = user_id_param OR followed_id = user_id_param;
  
  DELETE FROM user_answers
  WHERE user_ranking_id IN (
    SELECT id FROM user_rankings WHERE user_id = user_id_param
  );
  
  DELETE FROM user_rankings WHERE user_id = user_id_param;
  DELETE FROM users_profiles WHERE id = user_id_param;
  DELETE FROM auth.users WHERE id = user_id_param;
  
  RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO security_logs (user_id, action, details)
  VALUES (auth.uid(), 'admin_delete_user_profile_error', jsonb_build_object(
      'target_user_id', user_id_param,
      'error', SQLERRM
  ));
  RETURN FALSE;
END;
$function$;

-- 4. Secure admin_delete_user_from_ranking function
CREATE OR REPLACE FUNCTION public.admin_delete_user_from_ranking(ranking_id_param uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- SECURITY: Verify user has admin role
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    INSERT INTO security_logs (user_id, action, details)
    VALUES (auth.uid(), 'unauthorized_admin_ranking_delete_attempt', jsonb_build_object(
        'target_ranking_id', ranking_id_param
    ));
    RETURN FALSE;
  END IF;

  -- Log admin action
  INSERT INTO security_logs (user_id, action, details)
  VALUES (auth.uid(), 'admin_delete_user_from_ranking', jsonb_build_object(
      'target_ranking_id', ranking_id_param,
      'authorized', true
  ));
  
  DELETE FROM user_answers WHERE user_ranking_id = ranking_id_param;
  DELETE FROM user_rankings WHERE id = ranking_id_param;
  
  RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO security_logs (user_id, action, details)
  VALUES (auth.uid(), 'admin_delete_ranking_error', jsonb_build_object(
      'target_ranking_id', ranking_id_param,
      'error', SQLERRM
  ));
  RETURN FALSE;
END;
$function$;