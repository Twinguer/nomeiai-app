-- ============================================================================
-- CORREÇÃO FORÇADA: Remover Política Bloqueadora e Garantir Recálculo Funcione
-- ============================================================================
-- Esta migration é uma versão mais agressiva que força a remoção da política
-- bloqueadora e verifica se o problema persiste.
-- ============================================================================

-- ============================================================================
-- PARTE 1: FORÇAR REMOÇÃO DE TODAS AS POLÍTICAS UPDATE CONFLITANTES
-- ============================================================================

-- Remover TODAS as políticas UPDATE conhecidas (forçar limpeza completa)
DO $$
DECLARE
  policy_record RECORD;
BEGIN
  -- Listar todas as políticas UPDATE existentes
  FOR policy_record IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_rankings'
      AND cmd = 'UPDATE'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.user_rankings', policy_record.policyname);
    RAISE NOTICE 'Removida política: %', policy_record.policyname;
  END LOOP;
END $$;

-- ============================================================================
-- PARTE 2: CRIAR APENAS A POLÍTICA CORRETA (SEM RESTRIÇÕES BLOQUEADORAS)
-- ============================================================================

-- Criar política que permite UPDATEs de usuários normais
-- IMPORTANTE: Esta política NÃO bloqueia funções SECURITY DEFINER com SET LOCAL
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

-- Remover todas as políticas SELECT e criar apenas a pública
DO $$
DECLARE
  policy_record RECORD;
BEGIN
  FOR policy_record IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_rankings'
      AND cmd = 'SELECT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.user_rankings', policy_record.policyname);
    RAISE NOTICE 'Removida política SELECT: %', policy_record.policyname;
  END LOOP;
END $$;

-- Criar política pública de SELECT
CREATE POLICY "Public can view all ranking data"
ON public.user_rankings
FOR SELECT
USING (true);

-- ============================================================================
-- PARTE 4: VERIFICAR E GARANTIR QUE FUNÇÃO DE RECÁLCULO ESTÁ CORRETA
-- ============================================================================

-- Garantir que a função tem SET LOCAL row_security = 'off'
-- Se não tiver, isso vai falhar e alertar
DO $$
BEGIN
  -- Verificar se a função existe e tem o código correto
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname = 'recalculate_all_scores_with_weights'
      AND p.prosrc LIKE '%set_config%row_security%off%'
  ) THEN
    RAISE WARNING 'Função recalculate_all_scores_with_weights pode não ter SET LOCAL row_security = off';
  ELSE
    RAISE NOTICE 'Função recalculate_all_scores_with_weights verificada: tem SET LOCAL row_security = off';
  END IF;
END $$;

-- ============================================================================
-- PARTE 5: GRANT EXECUTE (garantir que está aplicado)
-- ============================================================================

-- Garantir permissão de execução para todos
GRANT EXECUTE ON FUNCTION public.recalculate_all_scores_with_weights(uuid) TO anon, authenticated;

-- ============================================================================
-- PARTE 6: LOG E VERIFICAÇÃO FINAL
-- ============================================================================

DO $$
DECLARE
  update_policy_count INTEGER;
  select_policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO update_policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'user_rankings'
    AND cmd = 'UPDATE';

  SELECT COUNT(*) INTO select_policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'user_rankings'
    AND cmd = 'SELECT';

  RAISE NOTICE '========================================';
  RAISE NOTICE 'VERIFICAÇÃO FINAL:';
  RAISE NOTICE '  Políticas UPDATE ativas: %', update_policy_count;
  RAISE NOTICE '  Políticas SELECT ativas: %', select_policy_count;
  RAISE NOTICE '========================================';

  IF update_policy_count > 1 THEN
    RAISE WARNING 'Múltiplas políticas UPDATE encontradas - pode haver conflito';
  END IF;

  IF update_policy_count = 0 THEN
    RAISE WARNING 'Nenhuma política UPDATE encontrada - UPDATEs podem estar bloqueados';
  END IF;
END $$;

