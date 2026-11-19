-- ============================================================================
-- CORREÇÃO: Remover Política Restritiva que Bloqueia Recálculo Público
-- ============================================================================
-- PROBLEMA IDENTIFICADO: 
--   A política "secure_users_update_own_rankings" criada pela migration
--   20251025012308 está bloqueando funções SECURITY DEFINER de atualizar
--   rankings de outros usuários, impedindo o recálculo público.
--
-- SOLUÇÃO:
--   1. Remover política restritiva que bloqueia funções do sistema
--   2. Manter política mais permissiva que permite fallback
--   3. Garantir que funções SECURITY DEFINER com SET LOCAL row_security = 'off'
--      possam fazer UPDATEs corretamente
-- ============================================================================

-- ============================================================================
-- PARTE 1: REMOVER POLÍTICAS RESTRITIVAS CONFLITANTES
-- ============================================================================

-- Remover política criada em 20251025012308 que bloqueia funções SECURITY DEFINER
DROP POLICY IF EXISTS "secure_users_update_own_rankings" ON public.user_rankings;

-- Remover também política criada em 20251025012105 (pode estar duplicada)
DROP POLICY IF EXISTS "Users can update their own rankings" ON public.user_rankings;

-- ============================================================================
-- PARTE 2: GARANTIR QUE POLÍTICA CORRETA ESTÁ ATIVA
-- ============================================================================

-- Verificar se a política correta já existe (criada em 20250127000008)
-- Se não existir, criar. Se existir, garantir que está correta.
DROP POLICY IF EXISTS "users_update_own_rankings_with_rate_limit" ON public.user_rankings;

-- Recriar política com fallback para permitir operações mesmo se check_rate_limit falhar
CREATE POLICY "users_update_own_rankings_with_rate_limit"
ON public.user_rankings
FOR UPDATE
USING (
  auth.uid() = user_id
  AND (
    -- Se a função check_rate_limit não existir, permitir
    NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'check_rate_limit')
    OR public.check_rate_limit(auth.uid(), 'update_user_rankings', 100, 60)->>'allowed' = 'true'
  )
)
WITH CHECK (
  auth.uid() = user_id
  AND (
    -- Se a função check_rate_limit não existir, permitir
    NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'check_rate_limit')
    OR public.check_rate_limit(auth.uid(), 'update_user_rankings', 100, 60)->>'allowed' = 'true'
  )
);

-- ============================================================================
-- PARTE 3: GARANTIR POLÍTICA PÚBLICA DE SELECT
-- ============================================================================

-- Garantir que política pública de SELECT existe (necessária para visualização pública)
DROP POLICY IF EXISTS "Public can view all ranking data" ON public.user_rankings;

CREATE POLICY "Public can view all ranking data"
ON public.user_rankings
FOR SELECT
USING (true);

-- ============================================================================
-- PARTE 4: VERIFICAÇÃO E LOG
-- ============================================================================

-- Log da correção aplicada
DO $$
BEGIN
  RAISE NOTICE 'Correção aplicada: Política "secure_users_update_own_rankings" removida';
  RAISE NOTICE 'Política "users_update_own_rankings_with_rate_limit" garantida';
  RAISE NOTICE 'Política pública de SELECT garantida';
END $$;

-- ============================================================================
-- NOTAS IMPORTANTES:
-- ============================================================================
-- 1. A função recalculate_all_scores_with_weights já tem SET LOCAL row_security = 'off'
--    implementado, então ela conseguirá fazer UPDATEs após esta correção.
--
-- 2. Usuários normais continuam com rate limiting e validação auth.uid() = user_id.
--
-- 3. Funções SECURITY DEFINER com SET LOCAL row_security = 'off' podem fazer UPDATEs
--    em registros de todos os usuários, como esperado para recálculo em massa.
-- ============================================================================

