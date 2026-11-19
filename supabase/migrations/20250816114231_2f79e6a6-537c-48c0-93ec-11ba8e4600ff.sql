-- CRITICAL SECURITY FIXES - Phase 2

-- 1. Secure consolidated_answers_by_concurso table
DROP POLICY IF EXISTS "Todos podem ler dados consolidados" ON consolidated_answers_by_concurso;
DROP POLICY IF EXISTS "Sistema pode inserir dados consolidados" ON consolidated_answers_by_concurso;
DROP POLICY IF EXISTS "Sistema pode atualizar dados consolidados" ON consolidated_answers_by_concurso;

-- Only allow users to see consolidated data for concursos they participate in
CREATE POLICY "Users can only see consolidated data for their concursos"
ON consolidated_answers_by_concurso
FOR SELECT
TO authenticated
USING (
  concurso_id IN (
    SELECT concurso_id 
    FROM user_rankings 
    WHERE user_id = auth.uid()
  )
);

-- Only allow system functions to insert/update consolidated data
CREATE POLICY "Only system functions can insert consolidated data"
ON consolidated_answers_by_concurso
FOR INSERT
TO authenticated
WITH CHECK (false); -- Block all direct inserts

CREATE POLICY "Only system functions can update consolidated data"
ON consolidated_answers_by_concurso
FOR UPDATE
TO authenticated
USING (false); -- Block all direct updates

-- 2. Secure score_calculation_logs table
DROP POLICY IF EXISTS "score_calculation_logs_select_all" ON score_calculation_logs;
DROP POLICY IF EXISTS "score_calculation_logs_insert_all" ON score_calculation_logs;

-- Only allow users to see their own score calculation logs
CREATE POLICY "Users can only see their own score logs"
ON score_calculation_logs
FOR SELECT
TO authenticated
USING (
  user_ranking_id IN (
    SELECT id 
    FROM user_rankings 
    WHERE user_id = auth.uid()
  )
);

-- Only allow system functions to insert logs
CREATE POLICY "Only functions can insert score logs"
ON score_calculation_logs
FOR INSERT
TO authenticated
WITH CHECK (false); -- Will be bypassed by SECURITY DEFINER functions

-- 3. Secure user_answers table better
DROP POLICY IF EXISTS "user_answers_select_all" ON user_answers;
DROP POLICY IF EXISTS "Funções de sistema podem acessar todas respostas" ON user_answers;

-- Replace overly permissive policies
CREATE POLICY "Users can only see own answers and admins can see all"
ON user_answers
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM user_rankings ur 
    WHERE ur.id = user_answers.user_ranking_id 
    AND ur.user_id = auth.uid()
  ) 
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- 4. Secure user_rankings table better
DROP POLICY IF EXISTS "user_rankings_select_all" ON user_rankings;
DROP POLICY IF EXISTS "user_rankings_update_all" ON user_rankings;
DROP POLICY IF EXISTS "Allow service_role to update all rankings" ON user_rankings;

-- Replace overly permissive policies with secure ones
CREATE POLICY "Public can read basic ranking info"
ON user_rankings
FOR SELECT
TO authenticated
USING (true); -- This is OK for leaderboards

CREATE POLICY "Users can only update their own rankings"
ON user_rankings
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- 5. Enable RLS on users_profiles table (if not already enabled)
ALTER TABLE users_profiles ENABLE ROW LEVEL SECURITY;

-- Drop any overly permissive policies
DROP POLICY IF EXISTS "Enable read access for all users" ON users_profiles;
DROP POLICY IF EXISTS "Enable insert for all authenticated users" ON users_profiles;
DROP POLICY IF EXISTS "Enable update for all authenticated users" ON users_profiles;

-- Add proper RLS policies for users_profiles
CREATE POLICY "Public profiles are viewable by everyone"
ON users_profiles
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can insert their own profile"
ON users_profiles
FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid());

CREATE POLICY "Users can update their own profile"
ON users_profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

CREATE POLICY "Admins can delete profiles"
ON users_profiles
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- 6. Fix search path for remaining functions
CREATE OR REPLACE FUNCTION public.save_user_answers_consolidated_by_concurso(
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
    v_user_name TEXT;
    v_existing_data JSONB;
    v_booklet_answers JSONB := '{}';
    v_answer RECORD;
    v_answers_saved INTEGER := 0;
    v_total_users INTEGER;
BEGIN
    -- SECURITY: Verify user owns this ranking
    SELECT ur.user_id, up.name 
    INTO v_user_id, v_user_name
    FROM user_rankings ur
    LEFT JOIN users_profiles up ON up.id = ur.user_id
    WHERE ur.id = p_ranking_id;
    
    IF v_user_id IS NULL OR v_user_id != auth.uid() THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized access');
    END IF;

    -- Log security check
    INSERT INTO security_logs (user_id, action, details)
    VALUES (auth.uid(), 'save_consolidated_answers_attempt', jsonb_build_object(
        'ranking_id', p_ranking_id,
        'concurso_id', p_concurso_id,
        'authorized', true
    ));
    
    IF p_current_edit_count >= 5 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Limite de edições atingido');
    END IF;
    
    SELECT consolidated_data INTO v_existing_data
    FROM consolidated_answers_by_concurso
    WHERE concurso_id = p_concurso_id;
    
    IF v_existing_data IS NULL THEN
        v_existing_data := jsonb_build_object(
            'concurso_id', p_concurso_id,
            'users', '{}',
            'metadata', jsonb_build_object(
                'last_updated', now(),
                'version', '3.0',
                'total_users', 0
            )
        );
    END IF;
    
    IF v_existing_data->'users' IS NULL OR jsonb_typeof(v_existing_data->'users') = 'string' THEN
        v_existing_data := jsonb_set(v_existing_data, ARRAY['users'], '{}');
    END IF;
    
    FOR v_answer IN
        SELECT 
            key::integer as question_number,
            value::text as answer
        FROM jsonb_each_text(p_answers)
        WHERE key ~ '^[0-9]+$' AND value IS NOT NULL AND value != ''
    LOOP
        v_booklet_answers := jsonb_set(
            v_booklet_answers,
            ARRAY[v_answer.question_number::text],
            to_jsonb(v_answer.answer)
        );
        v_answers_saved := v_answers_saved + 1;
    END LOOP;
    
    v_existing_data := jsonb_set(
        v_existing_data,
        ARRAY['users', v_user_id::text],
        jsonb_build_object(
            'ranking_id', p_ranking_id,
            'user_name', COALESCE(v_user_name, 'Usuário'),
            'booklets', jsonb_build_object(
                p_booklet_id, jsonb_build_object(
                    'answers', v_booklet_answers,
                    'metadata', jsonb_build_object(
                        'completed_at', now(),
                        'answer_count', v_answers_saved
                    )
                )
            ),
            'subjective_scores', jsonb_build_object(
                'discursive', p_discursive_score,
                'case_study_1', p_case_study_1_score,
                'case_study_2', p_case_study_2_score,
                'case_study_3', p_case_study_3_score
            ),
            'selected_booklet', p_booklet_id,
            'edit_count', p_current_edit_count + 1,
            'last_updated', now()
        )
    );
    
    SELECT COUNT(*) INTO v_total_users
    FROM jsonb_object_keys(v_existing_data->'users') AS user_key;
    
    v_existing_data := jsonb_set(v_existing_data, ARRAY['metadata', 'last_updated'], to_jsonb(now()));
    v_existing_data := jsonb_set(v_existing_data, ARRAY['metadata', 'total_users'], to_jsonb(v_total_users));
    
    INSERT INTO consolidated_answers_by_concurso (concurso_id, consolidated_data, updated_at)
    VALUES (p_concurso_id, v_existing_data, now())
    ON CONFLICT (concurso_id)
    DO UPDATE SET
        consolidated_data = EXCLUDED.consolidated_data,
        updated_at = EXCLUDED.updated_at;
    
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