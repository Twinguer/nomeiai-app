-- Harden RLS approach: remove unsafe function and add secure public wrapper for batch recalculation

-- Revoke and drop the previously added unsafe function if exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'update_user_ranking_score'
      AND pg_get_function_identity_arguments(p.oid) = 'p_user_id uuid, p_concurso_id text, p_new_consolidated_data jsonb'
  ) THEN
    REVOKE EXECUTE ON FUNCTION public.update_user_ranking_score(uuid, text, jsonb) FROM anon;
    REVOKE EXECUTE ON FUNCTION public.update_user_ranking_score(uuid, text, jsonb) FROM authenticated;
    -- Optionally drop to avoid misuse
    DROP FUNCTION public.update_user_ranking_score(uuid, text, jsonb);
  END IF;
END $$;

-- Create a SECURITY DEFINER wrapper that triggers the official batch recalculation
-- This avoids RLS limitations and prevents clients from supplying arbitrary data
CREATE OR REPLACE FUNCTION public.recalc_concurso_scores_public(
  p_concurso_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result json;
BEGIN
  -- Extend timeout for heavy recalculations
  PERFORM set_config('statement_timeout', '120000', true);
  
  BEGIN
    -- Call the authoritative batch recalculation function
    v_result := (SELECT public.recalculate_all_scores_with_weights(p_concurso_id));
  EXCEPTION WHEN undefined_function THEN
    -- Graceful fallback when the internal function is not available
    RETURN json_build_object('success', false, 'error', 'Missing function recalculate_all_scores_with_weights');
  END;
  
  IF v_result IS NULL THEN
    RETURN json_build_object('success', true, 'updatedCount', null);
  END IF;
  
  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.recalc_concurso_scores_public(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.recalc_concurso_scores_public(uuid) TO authenticated;