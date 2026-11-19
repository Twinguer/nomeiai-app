-- Fase 2: token de ciclo para coach (valida vínculo + ciclo no JSONB antes de gerar)

CREATE OR REPLACE FUNCTION public.generate_coach_study_cycle_token(
  p_student_id UUID,
  p_cycle_id TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_coach_id UUID := auth.uid();
  v_access JSON;
  v_cycle_ok BOOLEAN := false;
  v_entity_id UUID;
  v_metadata JSONB;
  v_token TEXT;
BEGIN
  IF v_coach_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_student_id IS NULL OR p_cycle_id IS NULL OR trim(p_cycle_id) = '' THEN
    RAISE EXCEPTION 'invalid_arguments';
  END IF;

  v_access := public.check_coach_has_student_access(v_coach_id, p_student_id);

  IF COALESCE((v_access->>'allowed')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'access_denied: %', COALESCE(v_access->>'message', 'Acesso negado');
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM user_study_v2 us
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE
        WHEN jsonb_typeof(us.study_cycles) = 'array' THEN us.study_cycles
        ELSE '[]'::jsonb
      END
    ) AS c(value)
    WHERE us.user_id = p_student_id
      AND (c.value->>'id') = trim(p_cycle_id)
      AND COALESCE((c.value->>'is_active')::boolean, true) IS TRUE
  ) INTO v_cycle_ok;

  IF NOT v_cycle_ok THEN
    RAISE EXCEPTION 'cycle_not_found_or_inactive';
  END IF;

  IF trim(p_cycle_id) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
    v_entity_id := trim(p_cycle_id)::uuid;
    v_metadata := jsonb_build_object('user_id', p_student_id);
  ELSE
    v_entity_id := p_student_id;
    v_metadata := jsonb_build_object('user_id', p_student_id, 'cycle_id', trim(p_cycle_id));
  END IF;

  v_token := public.generate_secure_token(
    'study_cycle',
    v_entity_id,
    v_metadata,
    1440
  );

  RETURN v_token;
END;
$$;

COMMENT ON FUNCTION public.generate_coach_study_cycle_token(UUID, TEXT) IS
  'Gera token de URL para ciclo de estudo do aluno; exige coach autenticado com acesso ativo ao aluno.';

GRANT EXECUTE ON FUNCTION public.generate_coach_study_cycle_token(UUID, TEXT) TO authenticated;
