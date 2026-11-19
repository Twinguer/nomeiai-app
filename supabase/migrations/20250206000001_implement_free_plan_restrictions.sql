-- ============================================================================
-- MIGRATION: Implementar Restrições do Plano Free
-- DATA: 2025-02-06
-- OBJETIVO: Implementar todas as validações backend para o plano Free
-- ============================================================================

-- ============================================================================
-- 1. FUNÇÕES AUXILIARES
-- ============================================================================

-- Função: Obter plano de assinatura do usuário
CREATE OR REPLACE FUNCTION public.get_user_subscription_plan(p_user_id UUID)
RETURNS subscription_plan
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT plan
  FROM user_subscriptions
  WHERE user_id = p_user_id
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > NOW())
  LIMIT 1;
$$;

-- Função: Verificar se usuário é Pro
CREATE OR REPLACE FUNCTION public.is_user_pro(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT plan = 'pro'::subscription_plan
     FROM user_subscriptions
     WHERE user_id = p_user_id
       AND is_active = true
       AND (expires_at IS NULL OR expires_at > NOW())
     LIMIT 1),
    false
  );
$$;

-- Função: Verificar se usuário atual é Pro
CREATE OR REPLACE FUNCTION public.is_current_user_pro()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_user_pro(auth.uid());
$$;

-- ============================================================================
-- 2. VALIDAÇÕES DE RANKINGS
-- ============================================================================

-- Função: Verificar se pode participar de ranking
CREATE OR REPLACE FUNCTION public.check_can_participate_ranking(
  p_concurso_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_user_plan subscription_plan;
  v_active_rankings_count INTEGER;
  v_already_participating BOOLEAN;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'can_participate', false,
      'reason', 'Usuário não autenticado'
    );
  END IF;

  -- Verificar plano do usuário
  v_user_plan := public.get_user_subscription_plan(v_user_id);
  IF v_user_plan IS NULL THEN
    v_user_plan := 'free'::subscription_plan;
  END IF;

  -- Verificar se já está participando
  SELECT EXISTS (
    SELECT 1
    FROM user_rankings
    WHERE concurso_id = p_concurso_id
      AND user_id = v_user_id
  ) INTO v_already_participating;

  IF v_already_participating THEN
    RETURN jsonb_build_object(
      'can_participate', false,
      'reason', 'Você já está participando deste ranking'
    );
  END IF;

  -- Verificar limite por plano
  IF v_user_plan = 'free' THEN
    -- Free: máximo 1 ranking ativo
    SELECT COUNT(*)
    INTO v_active_rankings_count
    FROM user_rankings
    WHERE user_id = v_user_id;

    IF v_active_rankings_count >= 1 THEN
      RETURN jsonb_build_object(
        'can_participate', false,
        'reason', 'No plano Free você pode participar de apenas 1 ranking por vez. Faça upgrade para Pro.',
        'requires_upgrade', true
      );
    END IF;
  ELSIF v_user_plan = 'pro' THEN
    -- Pro: máximo 5 rankings ativos
    SELECT COUNT(*)
    INTO v_active_rankings_count
    FROM user_rankings
    WHERE user_id = v_user_id;

    IF v_active_rankings_count >= 5 THEN
      RETURN jsonb_build_object(
        'can_participate', false,
        'reason', 'Você já está participando de 5 rankings. Remova um para participar de outro.'
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'can_participate', true
  );
END;
$$;

-- Função: Verificar se pode editar respostas (limite de 5 edições para Free)
CREATE OR REPLACE FUNCTION public.check_can_edit_answers(
  p_ranking_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_user_plan subscription_plan;
  v_edit_count INTEGER;
  v_max_edits INTEGER;
  v_ranking_data JSONB;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'can_edit', false,
      'reason', 'Usuário não autenticado'
    );
  END IF;

  -- Verificar se o ranking pertence ao usuário e obter edit_count
  SELECT 
    COALESCE(edit_count, 0),
    consolidated_data
  INTO 
    v_edit_count,
    v_ranking_data
  FROM user_rankings
  WHERE id = p_ranking_id
    AND user_id = v_user_id;

  -- Se não encontrou registro, ranking não existe ou não pertence ao usuário
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'can_edit', false,
      'reason', 'Ranking não encontrado ou não pertence a você'
    );
  END IF;

  -- Verificar plano do usuário
  v_user_plan := public.get_user_subscription_plan(v_user_id);
  IF v_user_plan IS NULL THEN
    v_user_plan := 'free'::subscription_plan;
  END IF;

  -- Limite de edições por plano
  IF v_user_plan = 'free' THEN
    v_max_edits := 5;
  ELSE
    -- Pro: ilimitado
    RETURN jsonb_build_object(
      'can_edit', true
    );
  END IF;

  -- Usar edit_count da coluna ou do metadata como fallback
  v_edit_count := COALESCE(
    v_edit_count,
    (v_ranking_data->'metadata'->>'edit_count')::INTEGER,
    0
  );

  IF v_edit_count >= v_max_edits THEN
    RETURN jsonb_build_object(
      'can_edit', false,
      'reason', format('Você atingiu o limite de %s edições no plano Free. Faça upgrade para Pro para edições ilimitadas.', v_max_edits),
      'requires_upgrade', true,
      'edit_count', v_edit_count,
      'max_edits', v_max_edits
    );
  END IF;

  RETURN jsonb_build_object(
    'can_edit', true,
    'edit_count', v_edit_count,
    'max_edits', v_max_edits,
    'remaining_edits', v_max_edits - v_edit_count
  );
END;
$$;

-- Função: Verificar se pode ver ranking (Free só vê o que participa)
CREATE OR REPLACE FUNCTION public.can_view_ranking(
  p_concurso_id UUID
)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Pro pode ver todos, Free só pode ver se participa
  SELECT 
    public.is_user_pro(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM user_rankings
      WHERE concurso_id = p_concurso_id
        AND user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin'::app_role)
$$;

-- ============================================================================
-- 3. VALIDAÇÕES DE ESTATÍSTICAS
-- ============================================================================

-- Função: Verificar se pode ver estatísticas de estudos
CREATE OR REPLACE FUNCTION public.can_view_study_statistics(
  p_profile_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Pode ver se:
  -- 1. É o próprio perfil
  -- 2. É Pro e está vendo outro perfil
  -- 3. É admin
  SELECT 
    auth.uid() = p_profile_user_id
    OR public.is_user_pro(auth.uid())
    OR public.has_role(auth.uid(), 'admin'::app_role)
$$;

-- ============================================================================
-- 4. ATUALIZAR RLS POLICIES - RANKINGS
-- ============================================================================

-- Atualizar policy de SELECT para user_rankings (Free só vê seus próprios rankings)
DROP POLICY IF EXISTS "secure_users_view_own_rankings" ON public.user_rankings;

CREATE POLICY "secure_users_view_own_rankings"
  ON public.user_rankings FOR SELECT
  USING (
    -- Usuários podem ver seus próprios rankings (Free e Pro)
    auth.uid() = user_id
    OR
    -- Admins podem ver todos
    public.has_role(auth.uid(), 'admin'::app_role)
  );

-- Atualizar policy de INSERT para user_rankings (validar limite)
DROP POLICY IF EXISTS "secure_users_insert_own_rankings" ON public.user_rankings;

CREATE POLICY "secure_users_insert_own_rankings"
  ON public.user_rankings FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND public.check_can_participate_ranking(concurso_id)->>'can_participate' = 'true'
    AND public.check_rate_limit(auth.uid(), 'insert_user_rankings', 50, 60)->>'allowed' = 'true'
  );

-- Atualizar policy de UPDATE para user_rankings (validar edições)
DROP POLICY IF EXISTS "secure_users_update_own_rankings" ON public.user_rankings;

CREATE POLICY "secure_users_update_own_rankings"
  ON public.user_rankings FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND public.check_can_edit_answers(id)->>'can_edit' = 'true'
    AND public.check_rate_limit(auth.uid(), 'update_user_rankings', 100, 60)->>'allowed' = 'true'
  );

-- Atualizar policy de SELECT para concursos (Free só vê o que participa)
DROP POLICY IF EXISTS "free_users_can_only_view_participated_rankings" ON public.concursos;

CREATE POLICY "free_users_can_only_view_participated_rankings"
  ON public.concursos FOR SELECT
  USING (
    -- Pro pode ver todos
    public.is_user_pro(auth.uid())
    OR
    -- Free só pode ver se participa
    (
      NOT public.is_user_pro(auth.uid())
      AND EXISTS (
        SELECT 1
        FROM user_rankings ur
        WHERE ur.concurso_id = concursos.id
          AND ur.user_id = auth.uid()
      )
    )
    OR
    -- Admins podem ver todos
    public.has_role(auth.uid(), 'admin'::app_role)
  );

-- Policy para criação de rankings (apenas Pro)
DROP POLICY IF EXISTS "only_pro_users_can_create_rankings" ON public.concursos;

CREATE POLICY "only_pro_users_can_create_rankings"
  ON public.concursos FOR INSERT
  WITH CHECK (
    public.is_user_pro(auth.uid())
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

-- ============================================================================
-- 5. ATUALIZAR RLS POLICIES - CICLOS DE ESTUDOS
-- ============================================================================

-- Policy para criação de ciclos (apenas Pro)
DROP POLICY IF EXISTS "only_pro_users_can_create_cycles" ON public.study_cycles_v2;

CREATE POLICY "only_pro_users_can_create_cycles"
  ON public.study_cycles_v2 FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (
      public.is_user_pro(auth.uid())
      OR public.has_role(auth.uid(), 'admin'::app_role)
    )
  );

-- Atualizar trigger de limite de ciclos para incluir validação de plano
DROP TRIGGER IF EXISTS enforce_active_cycles_limit ON public.study_cycles_v2;
DROP FUNCTION IF EXISTS check_active_cycles_limit();

CREATE OR REPLACE FUNCTION check_active_cycles_limit()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_plan subscription_plan;
BEGIN
  -- Verificar plano do usuário
  v_user_plan := public.get_user_subscription_plan(NEW.user_id);
  IF v_user_plan IS NULL THEN
    v_user_plan := 'free'::subscription_plan;
  END IF;

  -- Free não pode criar ciclos
  IF v_user_plan = 'free' THEN
    RAISE EXCEPTION 'Ciclos de estudos estão disponíveis apenas no plano Pro. Faça upgrade para criar ciclos de estudos.'
      USING ERRCODE = 'P0001';
  END IF;

  -- Continuar com validação de limite de 2 ciclos ativos
  IF NEW.is_active = true THEN
    IF (SELECT COUNT(*) FROM public.study_cycles_v2 
        WHERE user_id = NEW.user_id 
        AND is_active = true 
        AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)) >= 2 THEN
      RAISE EXCEPTION 'Usuário já possui 2 ciclos ativos. Desative um ciclo antes de criar outro.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_active_cycles_limit
  BEFORE INSERT OR UPDATE ON public.study_cycles_v2
  FOR EACH ROW
  EXECUTE FUNCTION check_active_cycles_limit();

-- ============================================================================
-- 6. ATUALIZAR RLS POLICIES - GRUPOS DE ESTUDOS
-- ============================================================================

-- Policy para criação de grupos (apenas Pro)
DROP POLICY IF EXISTS "only_pro_users_can_create_groups" ON public.study_groups;

CREATE POLICY "only_pro_users_can_create_groups"
  ON public.study_groups FOR INSERT
  WITH CHECK (
    auth.uid() = created_by
    AND (
      public.is_user_pro(auth.uid())
      OR public.has_role(auth.uid(), 'admin'::app_role)
    )
  );

-- Policy para participação em grupos (apenas Pro)
DROP POLICY IF EXISTS "only_pro_users_can_join_groups" ON public.study_group_members;

CREATE POLICY "only_pro_users_can_join_groups"
  ON public.study_group_members FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (
      public.is_user_pro(auth.uid())
      OR public.has_role(auth.uid(), 'admin'::app_role)
    )
  );

-- ============================================================================
-- 7. ATUALIZAR RLS POLICIES - MODO COACH
-- ============================================================================

-- Policy para acesso ao modo coach (apenas Pro)
DROP POLICY IF EXISTS "only_pro_users_can_access_coach_mode" ON public.coach_profiles;

CREATE POLICY "only_pro_users_can_access_coach_mode"
  ON public.coach_profiles FOR SELECT
  USING (
    auth.uid() = coach_id
    AND (
      public.is_user_pro(auth.uid())
      OR public.has_role(auth.uid(), 'admin'::app_role)
    )
  );

-- Policy para visualização de assinaturas coach (apenas Pro)
DROP POLICY IF EXISTS "only_pro_users_can_view_coach_subscriptions" ON public.coach_subscriptions;

CREATE POLICY "only_pro_users_can_view_coach_subscriptions"
  ON public.coach_subscriptions FOR SELECT
  USING (
    auth.uid() = coach_id
    AND (
      public.is_user_pro(auth.uid())
      OR public.has_role(auth.uid(), 'admin'::app_role)
    )
  );

-- ============================================================================
-- 8. COMENTÁRIOS E DOCUMENTAÇÃO
-- ============================================================================

COMMENT ON FUNCTION public.get_user_subscription_plan(UUID) IS 
  'Retorna o plano de assinatura ativo do usuário. Retorna NULL se não tiver assinatura ativa.';

COMMENT ON FUNCTION public.is_user_pro(UUID) IS 
  'Verifica se o usuário possui plano Pro ativo. Retorna false se não tiver assinatura ou for Free.';

COMMENT ON FUNCTION public.check_can_participate_ranking(UUID) IS 
  'Valida se o usuário pode participar de um ranking. Free: máximo 1 ranking. Pro: máximo 5 rankings.';

COMMENT ON FUNCTION public.check_can_edit_answers(UUID) IS 
  'Valida se o usuário pode editar respostas. Free: máximo 5 edições. Pro: ilimitado.';

COMMENT ON FUNCTION public.can_view_ranking(UUID) IS 
  'Verifica se o usuário pode visualizar um ranking. Free: apenas rankings que participa. Pro: todos.';

COMMENT ON FUNCTION public.can_view_study_statistics(UUID) IS 
  'Verifica se o usuário pode ver estatísticas de estudos de outro usuário. Free: apenas próprias. Pro: todas.';

-- ============================================================================
-- FIM DA MIGRATION
-- ============================================================================



