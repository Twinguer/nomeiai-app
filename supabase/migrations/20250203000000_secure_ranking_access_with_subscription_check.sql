-- ============================================================================
-- CORREÇÃO DE SEGURANÇA: Verificação de Subscription no Backend + Atualizações
-- ============================================================================
-- PROBLEMA 1: Frontend verificava subscription (isPro), pode ser burlado
-- PROBLEMA 2: Usuários Free não veem atualizações dos rankings que participam
--
-- SOLUÇÃO:
--   1. Criar função RPC que verifica subscription no backend e retorna rankings
--   2. Pro: vê todos os rankings do concurso
--   3. Free autenticado: vê rankings do concurso apenas se participa
--   4. Corrigir política RLS para permitir acesso controlado
--   5. Função usa SECURITY DEFINER para garantir acesso aos dados
-- ============================================================================

-- ============================================================================
-- PARTE 1: Criar função helper para verificar se usuário é Pro
-- ============================================================================

CREATE OR REPLACE FUNCTION is_user_pro(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_subscription RECORD;
BEGIN
  -- Se não há usuário autenticado, retorna false
  IF p_user_id IS NULL THEN
    RETURN false;
  END IF;

  -- ✅ CRÍTICO: Desabilitar RLS temporariamente para garantir acesso aos dados
  -- A política de user_subscriptions pode estar restritiva
  PERFORM set_config('row_security', 'off', true);

  -- Buscar assinatura do usuário
  SELECT plan, is_active, expires_at INTO v_subscription
  FROM user_subscriptions
  WHERE user_id = p_user_id;

  -- Reabilitar RLS
  PERFORM set_config('row_security', 'on', true);

  -- Se não encontrar assinatura ou não estiver ativa, é Free
  IF v_subscription IS NULL OR NOT v_subscription.is_active THEN
    RETURN false;
  END IF;

  -- Se for Pro e não expirado (ou sem expiração), é Pro
  IF v_subscription.plan = 'pro' THEN
    IF v_subscription.expires_at IS NULL OR v_subscription.expires_at > NOW() THEN
      RETURN true;
    END IF;
  END IF;

  -- Caso contrário, é Free
  RETURN false;
  
EXCEPTION
  WHEN OTHERS THEN
    -- ✅ CRÍTICO: Reabilitar RLS mesmo em caso de erro
    PERFORM set_config('row_security', 'on', true);
    RETURN false;
END;
$$;

COMMENT ON FUNCTION is_user_pro IS 
'Verifica se usuário tem subscription Pro válida. Verificação segura no backend.
Retorna true apenas se: plan=pro, is_active=true e (expires_at IS NULL ou expires_at > NOW())';

-- ============================================================================
-- PARTE 2: Criar função para verificar se usuário participa de um concurso
-- ============================================================================

CREATE OR REPLACE FUNCTION user_participates_in_concurso(
  p_user_id UUID,
  p_concurso_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_consolidated_data JSONB;
  v_ranking_key TEXT;
BEGIN
  -- Se não há usuário ou concurso, retorna false
  IF p_user_id IS NULL OR p_concurso_id IS NULL THEN
    RETURN false;
  END IF;

  -- ✅ CRÍTICO: Desabilitar RLS temporariamente para garantir acesso aos dados
  -- Esta função é chamada dentro de get_rankings_for_concurso que já desabilitou RLS,
  -- mas garantimos aqui também para casos de chamada direta
  PERFORM set_config('row_security', 'off', true);

  -- Buscar consolidated_data do usuário
  SELECT consolidated_data INTO v_consolidated_data
  FROM user_rankings
  WHERE user_id = p_user_id
  LIMIT 1;

  -- Reabilitar RLS
  PERFORM set_config('row_security', 'on', true);

  -- Se não encontrar dados, não participa
  IF v_consolidated_data IS NULL OR v_consolidated_data = '{}'::jsonb THEN
    RETURN false;
  END IF;

  -- Verificar se algum ranking tem este concurso_id
  IF v_consolidated_data ? 'rankings' AND jsonb_typeof(v_consolidated_data->'rankings') = 'object' THEN
    FOR v_ranking_key IN
      SELECT key FROM jsonb_object_keys(v_consolidated_data->'rankings') AS key
    LOOP
      IF (v_consolidated_data->'rankings'->v_ranking_key->>'concurso_id')::uuid = p_concurso_id THEN
        RETURN true;
      END IF;
    END LOOP;
  END IF;

  RETURN false;
  
EXCEPTION
  WHEN OTHERS THEN
    -- ✅ CRÍTICO: Reabilitar RLS mesmo em caso de erro
    PERFORM set_config('row_security', 'on', true);
    RETURN false;
END;
$$;

COMMENT ON FUNCTION user_participates_in_concurso IS 
'Verifica se usuário participa de um concurso específico. Verificação segura no backend.';

-- ============================================================================
-- PARTE 3: Criar função RPC principal que retorna rankings com verificação de subscription
-- ============================================================================

CREATE OR REPLACE FUNCTION get_rankings_for_concurso(
  p_concurso_id UUID,
  p_reservation_type TEXT DEFAULT NULL,
  p_offset INTEGER DEFAULT 0,
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
  user_id UUID,
  consolidated_data JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_is_pro BOOLEAN;
  v_participates BOOLEAN;
BEGIN
  -- ✅ CRÍTICO: Desabilitar RLS temporariamente para garantir acesso aos dados
  -- A função usa SECURITY DEFINER, então precisa desabilitar RLS para ver todos os registros
  PERFORM set_config('row_security', 'off', true);  -- true = LOCAL (apenas esta transação)

  -- Obter ID do usuário atual
  v_user_id := auth.uid();

  -- Se não autenticado, retornar vazio (não pode ver rankings)
  IF v_user_id IS NULL THEN
    -- Reabilitar RLS antes de retornar
    PERFORM set_config('row_security', 'on', true);
    RETURN;
  END IF;

  -- Verificar se é Pro
  v_is_pro := is_user_pro(v_user_id);

  -- Se for Pro, retornar todos os rankings do concurso
  IF v_is_pro THEN
    RETURN QUERY
    SELECT 
      ur.user_id,
      ur.consolidated_data
    FROM user_rankings ur
    WHERE ur.consolidated_data IS NOT NULL
      AND ur.consolidated_data != '{}'::jsonb
      AND ur.consolidated_data ? 'rankings'
      AND EXISTS (
        SELECT 1
        FROM jsonb_object_keys(ur.consolidated_data->'rankings') AS ranking_key
        WHERE (ur.consolidated_data->'rankings'->ranking_key->>'concurso_id')::uuid = p_concurso_id
          -- ✅ CORREÇÃO: Filtrar por reservation_type se fornecido
          AND (
            p_reservation_type IS NULL 
            OR p_reservation_type = ''
            OR (ur.consolidated_data->'rankings'->ranking_key->'user_data'->>'reservation_type') = p_reservation_type
          )
      )
    OFFSET p_offset
    LIMIT p_limit;
    
    -- Reabilitar RLS antes de retornar
    PERFORM set_config('row_security', 'on', true);
    RETURN;
  END IF;

  -- Se for Free, verificar se participa
  v_participates := user_participates_in_concurso(v_user_id, p_concurso_id);

  -- Se não participa, retornar vazio
  IF NOT v_participates THEN
    -- Reabilitar RLS antes de retornar
    PERFORM set_config('row_security', 'on', true);
    RETURN;
  END IF;

  -- Se participa, retornar todos os rankings do concurso (para ver a classificação completa)
  RETURN QUERY
  SELECT 
    ur.user_id,
    ur.consolidated_data
  FROM user_rankings ur
  WHERE ur.consolidated_data IS NOT NULL
    AND ur.consolidated_data != '{}'::jsonb
    AND ur.consolidated_data ? 'rankings'
    AND EXISTS (
      SELECT 1
      FROM jsonb_object_keys(ur.consolidated_data->'rankings') AS ranking_key
      WHERE (ur.consolidated_data->'rankings'->ranking_key->>'concurso_id')::uuid = p_concurso_id
        -- ✅ CORREÇÃO: Filtrar por reservation_type se fornecido
        AND (
          p_reservation_type IS NULL 
          OR p_reservation_type = ''
          OR (ur.consolidated_data->'rankings'->ranking_key->'user_data'->>'reservation_type') = p_reservation_type
        )
    )
  OFFSET p_offset
  LIMIT p_limit;
  
  -- Reabilitar RLS antes de retornar
  PERFORM set_config('row_security', 'on', true);
  
EXCEPTION
  WHEN OTHERS THEN
    -- ✅ CRÍTICO: Reabilitar RLS mesmo em caso de erro
    PERFORM set_config('row_security', 'on', true);
    RAISE;
END;
$$;

COMMENT ON FUNCTION get_rankings_for_concurso IS 
'Retorna rankings de um concurso com verificação segura de subscription no backend.
Pro: vê todos os rankings do concurso.
Free autenticado: vê rankings do concurso apenas se participa.
Não autenticado: não vê nada.
Usa SECURITY DEFINER para garantir acesso aos dados mesmo com RLS restritiva.';

-- ============================================================================
-- PARTE 4: Garantir GRANT EXECUTE para usuários autenticados
-- ============================================================================

GRANT EXECUTE ON FUNCTION is_user_pro(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION user_participates_in_concurso(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_rankings_for_concurso(UUID, TEXT, INTEGER, INTEGER) TO authenticated;

-- ============================================================================
-- PARTE 5: Corrigir política RLS para permitir acesso controlado
-- ============================================================================

-- Remover TODAS as políticas SELECT conflitantes
DROP POLICY IF EXISTS "Public can view all ranking data" ON public.user_rankings;
DROP POLICY IF EXISTS "public_can_view_all_rankings" ON public.user_rankings;
DROP POLICY IF EXISTS "secure_users_view_own_rankings" ON public.user_rankings;
DROP POLICY IF EXISTS "Users can view own rankings only" ON public.user_rankings;
DROP POLICY IF EXISTS "Public can read basic ranking info" ON public.user_rankings;
DROP POLICY IF EXISTS "Users can view public leaderboard data" ON public.user_rankings;
DROP POLICY IF EXISTS "Secure ranking access based on subscription" ON public.user_rankings;

-- Criar política que permite:
-- 1. Usuários veem seu próprio user_rankings (necessário para a função verificar participação)
-- 2. Pro vê todos (mas isso será controlado pela função RPC)
-- A função RPC usa SECURITY DEFINER então pode acessar tudo, mas a política ainda precisa permitir
-- que usuários vejam seu próprio registro para a função funcionar
CREATE POLICY "Users can view own rankings"
ON public.user_rankings
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Permitir que função SECURITY DEFINER veja tudo (via bypass de RLS interno)
-- A política acima permite acesso básico, e a função RPC com SECURITY DEFINER
-- permite acesso controlado baseado em subscription

-- ============================================================================
-- PARTE 6: Garantir acesso a users_profiles para exibir nomes
-- ============================================================================

DROP POLICY IF EXISTS "Public can view basic profile info only" ON public.users_profiles;
DROP POLICY IF EXISTS "Users can view all basic profile info" ON public.users_profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.users_profiles;
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.users_profiles;

-- Permitir que usuários autenticados vejam perfis (necessário para exibir nomes nos rankings)
CREATE POLICY "Authenticated users can view profiles"
ON public.users_profiles
FOR SELECT
TO authenticated
USING (true);

-- Garantir GRANTs
GRANT SELECT ON public.user_rankings TO authenticated;
GRANT SELECT ON public.users_profiles TO authenticated;

-- ============================================================================
-- PARTE 7: Log e documentação
-- ============================================================================

COMMENT ON POLICY "Users can view own rankings" ON public.user_rankings IS 
'Permite que usuários vejam seu próprio registro de user_rankings.
Acesso a rankings de concursos específicos é controlado pela função get_rankings_for_concurso
que verifica subscription no backend de forma segura.';

COMMENT ON POLICY "Authenticated users can view profiles" ON public.users_profiles IS 
'Permite que usuários autenticados vejam informações básicas de perfis (nome, avatar).
Necessário para exibir nomes dos participantes nos rankings.';

SELECT 'Migration aplicada: Verificação de subscription no backend implementada com sucesso!' AS status;

