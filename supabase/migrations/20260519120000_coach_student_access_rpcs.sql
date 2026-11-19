-- ============================================================================
-- Modo Coach: RPCs de acesso a alunos (sem alterar user_rankings / RLS de ranking)
-- Superseded by 20260519120001_coach_student_access_rpcs_upgrade.sql if RETURNS JSON conflict
-- ============================================================================

DROP FUNCTION IF EXISTS public.check_coach_has_student_access(UUID, UUID);
DROP FUNCTION IF EXISTS public.get_coach_student_display(UUID);

CREATE OR REPLACE FUNCTION public.check_coach_has_student_access(
  p_coach_id UUID,
  p_student_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_has_active_subscription BOOLEAN := false;
  v_has_relationship BOOLEAN := false;
BEGIN
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'not_authenticated',
      'message', 'Usuário não autenticado'
    );
  END IF;

  IF v_caller IS DISTINCT FROM p_coach_id THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'forbidden_coach',
      'message', 'Acesso negado'
    );
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM coach_subscriptions cs
    WHERE cs.coach_id = p_coach_id
      AND cs.status = 'active'
      AND (cs.expires_at IS NULL OR cs.expires_at > NOW())
  ) INTO v_has_active_subscription;

  IF NOT v_has_active_subscription THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'no_active_subscription',
      'message', 'Assinatura Coach inativa ou expirada'
    );
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM coach_profiles cp
    CROSS JOIN LATERAL jsonb_array_elements(cp.student_relationships) AS rel(value)
    WHERE cp.coach_id = p_coach_id
      AND (rel.value->>'student_id')::uuid = p_student_id
      AND COALESCE(rel.value->>'status', '') = 'active'
  ) INTO v_has_relationship;

  IF NOT v_has_relationship THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'not_in_team',
      'message', 'Aluno não faz parte da sua equipe ou vínculo inativo'
    );
  END IF;

  RETURN jsonb_build_object('allowed', true, 'reason', 'ok');
END;
$$;

COMMENT ON FUNCTION public.check_coach_has_student_access(UUID, UUID) IS
'Verifica se o coach autenticado tem vínculo ativo com o aluno e assinatura coach ativa. Não expõe dados pessoais.';

GRANT EXECUTE ON FUNCTION public.check_coach_has_student_access(UUID, UUID) TO authenticated;

-- Exibição mínima do aluno (sem e-mail nem perfil completo)
CREATE OR REPLACE FUNCTION public.get_coach_student_display(
  p_student_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_access JSONB;
  v_name TEXT;
  v_avatar TEXT;
BEGIN
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  v_access := public.check_coach_has_student_access(v_caller, p_student_id);

  IF COALESCE((v_access->>'allowed')::boolean, false) IS NOT TRUE THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', COALESCE(v_access->>'reason', 'access_denied'),
      'message', COALESCE(v_access->>'message', 'Acesso negado')
    );
  END IF;

  SELECT up.name, up.avatar_url
  INTO v_name, v_avatar
  FROM users_profiles up
  WHERE up.id = p_student_id
  LIMIT 1;

  RETURN jsonb_build_object(
    'success', true,
    'display_name', COALESCE(NULLIF(trim(v_name), ''), 'Aluno'),
    'avatar_url', v_avatar
  );
END;
$$;

COMMENT ON FUNCTION public.get_coach_student_display(UUID) IS
'Retorna nome e avatar do aluno para o coach autenticado, após validar vínculo. Sem e-mail ou dados sensíveis.';

GRANT EXECUTE ON FUNCTION public.get_coach_student_display(UUID) TO authenticated;
