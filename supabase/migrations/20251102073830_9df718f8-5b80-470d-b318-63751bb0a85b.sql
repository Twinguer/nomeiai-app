-- Create a security definer function to update user rankings scores
-- This bypasses RLS and allows the system to update all user scores when answer key changes

CREATE OR REPLACE FUNCTION public.update_user_ranking_score(
  p_user_id uuid,
  p_concurso_id text,
  p_new_consolidated_data jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update the user ranking with new calculated data
  UPDATE user_rankings
  SET consolidated_data = jsonb_set(
    COALESCE(consolidated_data, '{}'::jsonb),
    ARRAY[p_concurso_id],
    p_new_consolidated_data,
    true
  )
  WHERE user_id = p_user_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.update_user_ranking_score(uuid, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_user_ranking_score(uuid, text, jsonb) TO anon;

-- Create a function to recalculate scores for all participants of a contest
CREATE OR REPLACE FUNCTION public.recalculate_concurso_scores(p_concurso_id text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  -- This function can be called to trigger recalculation for all users
  -- The actual score calculation logic should be in the edge function
  -- This just ensures the trigger/notification happens
  
  -- Notify that recalculation is needed
  PERFORM pg_notify('ranking_recalculation', json_build_object(
    'concurso_id', p_concurso_id,
    'timestamp', now()
  )::text);
  
  -- Count affected users
  SELECT COUNT(DISTINCT user_id) INTO v_count
  FROM user_rankings
  WHERE consolidated_data ? p_concurso_id;
  
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.recalculate_concurso_scores(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalculate_concurso_scores(text) TO anon;