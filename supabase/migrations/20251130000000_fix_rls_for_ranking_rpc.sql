-- ============================================================================
-- CORREÇÃO: Ajustar RLS para permitir que get_rankings_for_concurso funcione
-- ============================================================================

-- A função get_rankings_for_concurso usa SECURITY DEFINER e desabilita RLS,
-- mas ainda precisa que a política básica permita acesso para funcionar corretamente

-- Remover política muito restritiva que pode estar bloqueando
DROP POLICY IF EXISTS "secure_users_view_own_rankings" ON public.user_rankings;

-- Criar política que permite:
-- 1. Usuários veem seu próprio user_rankings (necessário para verificação de participação)
-- 2. Funções SECURITY DEFINER podem acessar tudo (via bypass de RLS)
CREATE POLICY "users_can_view_own_rankings_for_rpc"
  ON public.user_rankings FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Comentário explicativo
COMMENT ON POLICY "users_can_view_own_rankings_for_rpc" ON public.user_rankings IS 
'Permite que usuários vejam seus próprios rankings. Funções SECURITY DEFINER (como get_rankings_for_concurso) 
podem acessar todos os dados via bypass de RLS usando set_config(''row_security'', ''off'', true).';



























