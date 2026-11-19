-- Remove participação de um usuário em um concurso específico (modelo consolidated_data).

BEGIN;

CREATE OR REPLACE FUNCTION public.admin_remove_user_from_concurso(
  p_user_id uuid,
  p_concurso_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_row user_rankings%ROWTYPE;
  v_rankings jsonb;
  v_key text;
  v_found boolean := false;
  v_updated jsonb;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    INSERT INTO security_logs (user_id, action, details)
    VALUES (
      auth.uid(),
      'unauthorized_admin_ranking_delete_attempt',
      jsonb_build_object('target_user_id', p_user_id, 'target_concurso_id', p_concurso_id)
    );
    RETURN FALSE;
  END IF;

  SELECT *
  INTO v_row
  FROM user_rankings
  WHERE user_id = p_user_id
  LIMIT 1;

  IF NOT FOUND OR v_row.consolidated_data IS NULL THEN
    RETURN FALSE;
  END IF;

  v_rankings := COALESCE(v_row.consolidated_data -> 'rankings', '{}'::jsonb);
  IF jsonb_typeof(v_rankings) <> 'object' THEN
    RETURN FALSE;
  END IF;

  FOR v_key IN SELECT jsonb_object_keys(v_rankings)
  LOOP
    IF v_key = p_concurso_id::text
       OR (v_rankings -> v_key ->> 'concurso_id') = p_concurso_id::text THEN
      v_rankings := v_rankings - v_key;
      v_found := true;
      EXIT;
    END IF;
  END LOOP;

  IF NOT v_found THEN
    RETURN FALSE;
  END IF;

  v_updated := jsonb_set(
    COALESCE(v_row.consolidated_data, '{}'::jsonb),
    '{rankings}',
    v_rankings,
    true
  );

  UPDATE user_rankings
  SET consolidated_data = v_updated
  WHERE user_id = p_user_id;

  DELETE FROM score_calculation_logs
  WHERE user_ranking_id = p_user_id;

  INSERT INTO security_logs (user_id, action, details)
  VALUES (
    auth.uid(),
    'admin_remove_user_from_concurso',
    jsonb_build_object(
      'target_user_id', p_user_id,
      'target_concurso_id', p_concurso_id,
      'authorized', true
    )
  );

  RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO security_logs (user_id, action, details)
  VALUES (
    auth.uid(),
    'admin_remove_user_from_concurso_error',
    jsonb_build_object(
      'target_user_id', p_user_id,
      'target_concurso_id', p_concurso_id,
      'error', SQLERRM
    )
  );
  RETURN FALSE;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_remove_user_from_concurso(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_remove_user_from_concurso(uuid, uuid) TO authenticated;

COMMIT;
