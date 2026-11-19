-- Corrigir função check_free_user_ranking_limits para contar corretamente
-- rankings que o usuário participa mas NÃO criou
CREATE OR REPLACE FUNCTION public.check_free_user_ranking_limits(
  p_user_id UUID,
  p_concurso_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_pro BOOLEAN;
  v_is_creator BOOLEAN;
  v_participation_count INT := 0;
  v_result JSON;
  v_concurso_id UUID;
BEGIN
  -- Verificar se é usuário Pro (incluindo coaches ativos)
  SELECT EXISTS (
    SELECT 1 FROM user_subscriptions
    WHERE user_id = p_user_id
      AND is_active = true
      AND plan = 'pro'
      AND (expires_at IS NULL OR expires_at > NOW())
  ) OR EXISTS (
    SELECT 1 FROM coach_subscriptions
    WHERE coach_id = p_user_id
      AND status = 'active'
      AND (expires_at IS NULL OR expires_at > NOW())
  ) INTO v_is_pro;

  -- Se for Pro, liberar acesso
  IF v_is_pro THEN
    RETURN json_build_object(
      'allowed', true,
      'reason', 'pro_user',
      'is_pro', true
    );
  END IF;

  -- Verificar se é o criador do ranking
  SELECT EXISTS (
    SELECT 1 FROM concursos
    WHERE id = p_concurso_id
      AND created_by_user_id = p_user_id
  ) INTO v_is_creator;

  -- Se for o criador, permitir participação
  IF v_is_creator THEN
    RETURN json_build_object(
      'allowed', true,
      'reason', 'is_creator',
      'is_creator', true,
      'is_pro', false
    );
  END IF;

  -- Contar quantos rankings o usuário participa (excluindo os que criou)
  -- Buscar todos os rankings do usuário
  SELECT COUNT(DISTINCT (ranking_data->>'concurso_id')::UUID)
  INTO v_participation_count
  FROM user_rankings ur,
  LATERAL jsonb_each(ur.consolidated_data->'rankings') AS rankings(ranking_key, ranking_data)
  WHERE ur.user_id = p_user_id
    AND ur.consolidated_data IS NOT NULL
    AND ur.consolidated_data != '{}'::jsonb
    AND ur.consolidated_data ? 'rankings'
    AND (ranking_data->>'concurso_id')::UUID IS NOT NULL
    -- Excluir rankings que o usuário criou
    AND NOT EXISTS (
      SELECT 1 FROM concursos c
      WHERE c.id = (ranking_data->>'concurso_id')::UUID
        AND c.created_by_user_id = p_user_id
    );

  -- Usuários Free podem participar de até 2 rankings que não criaram
  IF v_participation_count >= 2 THEN
    RETURN json_build_object(
      'allowed', false,
      'reason', 'max_participations_reached',
      'current_count', v_participation_count,
      'max_allowed', 2,
      'is_pro', false,
      'message', 'Usuários Free podem participar de até 2 rankings que não criaram. Assine o plano Pro para participar de mais rankings.'
    );
  END IF;

  -- Permitir participação
  RETURN json_build_object(
    'allowed', true,
    'reason', 'within_limits',
    'current_count', v_participation_count,
    'max_allowed', 2,
    'is_pro', false
  );
END;
$$;

COMMENT ON FUNCTION public.check_free_user_ranking_limits(UUID, UUID) IS 
'Verifica se usuário Free pode participar de um ranking. Free users podem participar de até 2 rankings que não criaram, mas podem participar de todos os rankings que criaram.';

