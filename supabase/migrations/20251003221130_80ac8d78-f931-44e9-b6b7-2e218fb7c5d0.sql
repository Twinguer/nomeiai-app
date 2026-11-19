-- Drop the duplicate function with uuid parameter to resolve ambiguity
DROP FUNCTION IF EXISTS public.switch_user_booklet(uuid, uuid);

-- Ensure only the text version exists and is correct
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
    SELECT user_id, concurso_id, selected_booklet::text 
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