-- Criar função para verificar limites de participação em rankings para usuários Free
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
  v_participation_count INT;
  v_created_rankings_count INT;
  v_result JSON;
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
  SELECT COUNT(DISTINCT ranking_key) INTO v_participation_count
  FROM (
    SELECT jsonb_object_keys(consolidated_data->'rankings') AS ranking_key
    FROM user_rankings
    WHERE user_id = p_user_id
  ) AS rankings
  WHERE NOT EXISTS (
    SELECT 1 FROM concursos c
    WHERE c.id = (
      SELECT (consolidated_data->'rankings'->ranking_key->>'concurso_id')::UUID
      FROM user_rankings
      WHERE user_id = p_user_id
    )
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

-- Criar função para verificar limite de edições para usuários Free
CREATE OR REPLACE FUNCTION public.check_free_user_edit_limits(
  p_user_id UUID,
  p_ranking_id TEXT,
  p_current_edit_count INT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_pro BOOLEAN;
  v_result JSON;
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

  -- Se for Pro, permitir edições ilimitadas
  IF v_is_pro THEN
    RETURN json_build_object(
      'allowed', true,
      'reason', 'pro_user',
      'is_pro', true,
      'remaining_edits', NULL
    );
  END IF;

  -- Usuários Free têm limite de 3 edições
  IF p_current_edit_count >= 3 THEN
    RETURN json_build_object(
      'allowed', false,
      'reason', 'max_edits_reached',
      'current_count', p_current_edit_count,
      'max_allowed', 3,
      'remaining_edits', 0,
      'is_pro', false,
      'message', 'Você atingiu o limite de 3 edições para usuários Free. Assine o plano Pro para edições ilimitadas.'
    );
  END IF;

  -- Permitir edição
  RETURN json_build_object(
    'allowed', true,
    'reason', 'within_limits',
    'current_count', p_current_edit_count,
    'max_allowed', 3,
    'remaining_edits', 3 - p_current_edit_count,
    'is_pro', false
  );
END;
$$;

-- Atualizar RLS policy de study_groups para prevenir criação por Free users
DROP POLICY IF EXISTS "only_pro_users_can_create_groups" ON study_groups;

CREATE POLICY "only_pro_users_can_create_groups"
ON study_groups
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = created_by AND
  (
    -- Permitir se for Pro
    is_user_pro(auth.uid()) OR
    -- Permitir se for Admin
    has_role(auth.uid(), 'admin'::app_role)
  )