-- ============================================================================
-- CORREÇÃO FINAL: Última tabela sem RLS + Otimizações
-- ============================================================================

-- 1. Habilitar RLS na tabela user_rankings (problema restante)
ALTER TABLE IF EXISTS public.user_rankings ENABLE ROW LEVEL SECURITY;

-- 2. Garantir que user_rankings tenha policies completas
DROP POLICY IF EXISTS "Users can view their own rankings" ON public.user_rankings;
DROP POLICY IF EXISTS "Users can insert their own rankings" ON public.user_rankings;
DROP POLICY IF EXISTS "Users can update their own rankings" ON public.user_rankings;
DROP POLICY IF EXISTS "Users can delete their own rankings" ON public.user_rankings;

CREATE POLICY "secure_users_view_own_rankings"
  ON public.user_rankings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "secure_users_insert_own_rankings"
  ON public.user_rankings FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND public.check_rate_limit(auth.uid(), 'insert_user_rankings', 50, 60)->>'allowed' = 'true'
  );

CREATE POLICY "secure_users_update_own_rankings"
  ON public.user_rankings FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND public.check_rate_limit(auth.uid(), 'update_user_rankings', 100, 60)->>'allowed' = 'true'
  );

CREATE POLICY "secure_users_delete_own_rankings"
  ON public.user_rankings FOR DELETE
  USING (auth.uid() = user_id);

-- 3. Documentar sistema de segurança implementado
COMMENT ON TABLE public.secure_tokens IS 
  'Sistema de tokens seguros com expiração, revogação e auditoria automática';
  
COMMENT ON TABLE public.audit_logs IS 
  'Logs de auditoria completos com rastreamento de IP, user agent e metadata para compliance';

COMMENT ON FUNCTION public.check_resource_permission IS
  'Valida permissões granulares por tipo de recurso (rankings, estudos, concursos)';

COMMENT ON FUNCTION public.validate_input_security IS
  'Validação multi-camada contra SQLi, XSS, null bytes e tamanho máximo';

COMMENT ON FUNCTION public.check_rate_limit IS
  'Rate limiting baseado em audit logs com janela temporal configurável';

COMMENT ON FUNCTION public.audit_trigger_function IS
  'Trigger automático que registra INSERT/UPDATE/DELETE com old_data e new_data';

-- 4. Criar índices para otimizar performance de auditoria
CREATE INDEX IF NOT EXISTS idx_audit_logs_composite 
  ON public.audit_logs(user_id, action, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_secure_tokens_composite 
  ON public.secure_tokens(user_id, token_type, expires_at);

-- Finalização
SELECT 'Sistema de segurança completo implementado com sucesso!' AS status;