-- Persistência leve dos checks "Tarefas de hoje" no timer (por data + ciclo).

BEGIN;

CREATE OR REPLACE FUNCTION public.patch_timer_day_task_completions(
  p_user_id uuid,
  p_date_key text,
  p_cycle_id text,
  p_task_ids jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_current_user_id uuid := auth.uid();
  v_is_coach_student boolean := false;
BEGIN
  IF v_current_user_id IS NULL THEN
    RETURN false;
  END IF;

  IF v_current_user_id <> p_user_id THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.coach_profiles cp
      WHERE cp.coach_id = v_current_user_id
        AND EXISTS (
          SELECT 1
          FROM jsonb_array_elements(cp.student_relationships) rel(value)
          WHERE (rel.value->>'student_id')::uuid = p_user_id
            AND (rel.value->>'status')::text = 'active'
        )
    ) INTO v_is_coach_student;

    IF NOT v_is_coach_student THEN
      RETURN false;
    END IF;
  END IF;

  IF p_date_key IS NULL OR p_date_key !~ '^\d{4}-\d{2}-\d{2}$' THEN
    RETURN false;
  END IF;

  IF p_cycle_id IS NULL OR length(trim(p_cycle_id)) = 0 THEN
    RETURN false;
  END IF;

  IF p_task_ids IS NULL OR jsonb_typeof(p_task_ids) <> 'array' THEN
    RETURN false;
  END IF;

  UPDATE public.user_study_v2
  SET
    study_metadata = jsonb_set(
      COALESCE(study_metadata, '{}'::jsonb),
      ARRAY['timer_day_task_completions', p_date_key, p_cycle_id],
      p_task_ids,
      true
    ),
    last_activity_date = CURRENT_DATE,
    updated_at = NOW()
  WHERE user_id = p_user_id;

  RETURN FOUND;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.patch_timer_day_task_completions(uuid, text, text, jsonb) TO authenticated;

COMMIT;
