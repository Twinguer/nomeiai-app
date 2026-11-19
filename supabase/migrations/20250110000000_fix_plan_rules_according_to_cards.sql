-- ============================================================================
-- MIGRATION: Corrigir Regras dos Planos de Acordo com os Cards
-- DATA: 2025-01-10
-- OBJETIVO: Alinhar implementação com as regras descritas nos cards dos planos
-- ============================================================================
-- 
-- DISCREPÂNCIAS CORRIGIDAS:
-- 1. Free: Permitir rankings ilimitados que o usuário criou + até 2 que não criou
-- 2. Free: Alterar limite de edições de 5 para 3
-- ============================================================================

-- ============================================================================
-- PARTE 1: Corrigir limite de edições (Free: 5 -> 3)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_user_edit_limit(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subscription RECORD;
BEGIN
  -- Buscar assinatura do usuário na tabela user_subscriptions
  SELECT plan, is_active INTO v_subscription
  FROM user_subscriptions
  WHERE user_id = p_user_id;

  -- Retornar limite baseado no plano
  -- Se não encontrar assinatura ou não estiver ativa, assume Free (3 edições)
  IF v_subscription IS NULL OR NOT v_subscription.is_active THEN
    RETURN 3; -- Free = 3 edições (corrigido de 5 para 3)
  END IF;

  IF v_subscription.plan = 'pro' THEN
    RETURN 999999; -- Pro = praticamente ilimitado (999.999 edições)
  ELSE
    RETURN 3; -- Free = 3 edições (corrigido de 5 para 3)
  END IF;
END;
$$;

COMMENT ON FUNCTION get_user_edit_limit IS 
  'Retorna o limite de edições permitidas baseado no plano do usuário. Free=3, Pro=999999 (ilimitado)';

-- ============================================================================
-- PARTE 2: Corrigir limite de participação em rankings (Free)
-- ============================================================================
-- Regra corrigida:
-- - Free: Rankings ilimitados que o usuário criou + até 2 rankings que não criou
-- - Pro: Máximo 5 rankings simultâneos (sem distinção)
-- ============================================================================

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
  v_rankings_created_count INTEGER := 0;
  v_rankings_not_created_count INTEGER := 0;
  v_already_participating BOOLEAN;
  v_user_created_concurso BOOLEAN;
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

  -- Verificar se já está participando (usando estrutura consolidated_data)
  SELECT EXISTS (
    SELECT 1
    FROM user_rankings ur
    WHERE ur.user_id = v_user_id
      AND ur.consolidated_data IS NOT NULL
      AND ur.consolidated_data != '{}'::jsonb
      AND ur.consolidated_data ? 'rankings'
      AND EXISTS (
        SELECT 1
        FROM jsonb_object_keys(ur.consolidated_data->'rankings') AS ranking_key
        WHERE (ur.consolidated_data->'rankings'->ranking_key->>'concurso_id')::uuid = p_concurso_id
      )
  ) INTO v_already_participating;

  IF v_already_participating THEN
    RETURN jsonb_build_object(
      'can_participate', false,
      'reason', 'Você já está participando deste ranking'
    );
  END IF;

  -- Verificar se o usuário criou este concurso
  SELECT EXISTS (
    SELECT 1
    FROM concursos
    WHERE id = p_concurso_id
      AND created_by_user_id = v_user_id
  ) INTO v_user_created_concurso;

  -- Verificar limite por plano
  IF v_user_plan = 'free' THEN
    -- Free: Contar rankings criados vs não criados separadamente
    -- Rankings que o usuário criou (ilimitados)
    -- Rankings que o usuário não criou (máximo 2)
    
    -- Se o usuário criou este concurso, sempre pode participar
    IF v_user_created_concurso THEN
      RETURN jsonb_build_object(
        'can_participate', true,
        'reason', 'Você criou este ranking, pode participar sem limites'
      );
    END IF;

    -- Se não criou, contar quantos rankings não criados já participa
    SELECT COUNT(DISTINCT c.id)
    INTO v_rankings_not_created_count
    FROM user_rankings ur
    CROSS JOIN LATERAL jsonb_object_keys(ur.consolidated_data->'rankings') AS ranking_key
    JOIN concursos c ON c.id = (ur.consolidated_data->'rankings'->ranking_key->>'concurso_id')::uuid
    WHERE ur.user_id = v_user_id
      AND ur.consolidated_data IS NOT NULL
      AND ur.consolidated_data != '{}'::jsonb
      AND ur.consolidated_data ? 'rankings'
      AND c.created_by_user_id != v_user_id
      AND c.created_by_user_id IS NOT NULL; -- Excluir rankings criados por admin

    IF v_rankings_not_created_count >= 2 THEN
      RETURN jsonb_build_object(
        'can_participate', false,
        'reason', 'No plano Free você pode participar de até 2 rankings que não criou. Faça upgrade para Pro.',
        'requires_upgrade', true,
        'current_count', v_rankings_not_created_count,
        'max_allowed', 2
      );
    END IF;

  ELSIF v_user_plan = 'pro' THEN
    -- Pro: máximo 5 rankings ativos (sem distinção entre criados ou não)
    SELECT COUNT(DISTINCT (ur.consolidated_data->'rankings'->ranking_key->>'concurso_id')::uuid)
    INTO v_rankings_created_count
    FROM user_rankings ur
    CROSS JOIN LATERAL jsonb_object_keys(ur.consolidated_data->'rankings') AS ranking_key
    WHERE ur.user_id = v_user_id
      AND ur.consolidated_data IS NOT NULL
      AND ur.consolidated_data != '{}'::jsonb
      AND ur.consolidated_data ? 'rankings';

    IF v_rankings_created_count >= 5 THEN
      RETURN jsonb_build_object(
        'can_participate', false,
        'reason', 'Você já está participando de 5 rankings. Remova um para participar de outro.',
        'current_count', v_rankings_created_count,
        'max_allowed', 5
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'can_participate', true
  );
END;
$$;

COMMENT ON FUNCTION public.check_can_participate_ranking(UUID) IS 
  'Valida se o usuário pode participar de um ranking. 
   Free: Rankings ilimitados que criou + até 2 que não criou.
   Pro: Máximo 5 rankings simultâneos.';

-- ============================================================================
-- PARTE 3: Atualizar função check_can_edit_answers para usar novo limite
-- ============================================================================
-- Nota: A função original usa UUID, mas precisamos manter compatibilidade
-- com a estrutura atual que pode usar tanto UUID quanto TEXT (ranking_id interno)
-- ============================================================================

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
  v_max_edits INTEGER;
  v_edit_count INTEGER;
  v_ranking_data JSONB;
  v_consolidated_data JSONB;
  v_ranking_key TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'can_edit', false,
      'reason', 'Usuário não autenticado'
    );
  END IF;

  -- Verificar plano do usuário
  v_user_plan := public.get_user_subscription_plan(v_user_id);
  IF v_user_plan IS NULL THEN
    v_user_plan := 'free'::subscription_plan;
  END IF;

  -- Obter limite de edições baseado no plano
  v_max_edits := get_user_edit_limit(v_user_id);

  -- Buscar dados do ranking do usuário
  SELECT consolidated_data
  INTO v_consolidated_data
  FROM user_rankings
  WHERE user_id = v_user_id
    AND consolidated_data IS NOT NULL
    AND consolidated_data != '{}'::jsonb
  LIMIT 1;

  IF v_consolidated_data IS NULL THEN
    RETURN jsonb_build_object(
      'can_edit', false,
      'reason', 'Ranking não encontrado'
    );
  END IF;

  -- Procurar o ranking pelo concurso_id dentro do consolidated_data
  -- O p_ranking_id pode ser o ID do concurso ou um ranking_id interno
  SELECT ranking_key
  INTO v_ranking_key
  FROM jsonb_object_keys(v_consolidated_data->'rankings') AS ranking_key
  WHERE (v_consolidated_data->'rankings'->ranking_key->>'concurso_id')::uuid = p_ranking_id
     OR ranking_key = p_ranking_id::text
  LIMIT 1;

  IF v_ranking_key IS NULL THEN
    -- Tentar usar p_ranking_id diretamente como chave
    v_ranking_key := p_ranking_id::text;
    v_ranking_data := v_consolidated_data->'rankings'->v_ranking_key;
  ELSE
    v_ranking_data := v_consolidated_data->'rankings'->v_ranking_key;
  END IF;

  IF v_ranking_data IS NULL THEN
    RETURN jsonb_build_object(
      'can_edit', false,
      'reason', 'Ranking não encontrado nos dados do usuário'
    );
  END IF;

  -- Obter contador de edições atual
  v_edit_count := COALESCE(
    (v_ranking_data->'user_data'->>'edit_count')::INTEGER,
    (v_ranking_data->'control_metadata'->>'edit_count')::INTEGER,
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

COMMENT ON FUNCTION public.check_can_edit_answers(UUID) IS 
  'Valida se o usuário pode editar respostas. Free: máximo 3 edições. Pro: ilimitado.';

-- ============================================================================
-- PARTE 4: Verificar se há outras funções que precisam ser atualizadas
-- ============================================================================

-- A função save_user_answers_v3 já usa get_user_edit_limit, então será atualizada automaticamente
-- A função save_user_answers_consolidated_by_concurso também já usa get_user_edit_limit

-- ============================================================================
-- PARTE 5: Log e documentação
-- ============================================================================

SELECT 'Migration aplicada: Regras dos planos corrigidas de acordo com os cards!' AS status;

