-- ============================================================================
-- MIGRAÇÃO DE SEGURANÇA COMPLETA - VERSÃO CORRIGIDA
-- Sistema robusto de autenticação, autorização e auditoria
-- ============================================================================

-- 1. TABELA DE TOKENS SEGUROS
CREATE TABLE IF NOT EXISTS public.secure_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_type TEXT NOT NULL CHECK (token_type IN ('session', 'refresh', 'api', 'reset_password')),
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  ip_address INET,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_secure_tokens_user_id ON public.secure_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_secure_tokens_token_hash ON public.secure_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_secure_tokens_expires_at ON public.secure_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_secure_tokens_type ON public.secure_tokens(token_type);

ALTER TABLE public.secure_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own tokens"
  ON public.secure_tokens FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can revoke their own tokens"
  ON public.secure_tokens FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 2. TABELA DE AUDITORIA
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  old_data JSONB,
  new_data JSONB,
  ip_address INET,
  user_agent TEXT,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status TEXT NOT NULL CHECK (status IN ('success', 'failure', 'blocked')),
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_type ON public.audit_logs(resource_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_severity ON public.audit_logs(severity);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own audit logs"
  ON public.audit_logs FOR SELECT
  USING (auth.uid() = user_id);

-- 3. FUNÇÃO DE AUDITORIA AUTOMÁTICA
CREATE OR REPLACE FUNCTION public.audit_trigger_function()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_id UUID;
  v_action TEXT;
  v_severity TEXT := 'medium';
BEGIN
  v_user_id := auth.uid();
  
  IF TG_OP = 'INSERT' THEN
    v_action := 'create_' || TG_TABLE_NAME;
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'update_' || TG_TABLE_NAME;
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'delete_' || TG_TABLE_NAME;
    v_severity := 'high';
  END IF;
  
  INSERT INTO public.audit_logs (
    user_id,
    action,
    resource_type,
    resource_id,
    old_data,
    new_data,
    severity,
    status
  ) VALUES (
    v_user_id,
    v_action,
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
    v_severity,
    'success'
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 4. FUNÇÃO DE VALIDAÇÃO DE PERMISSÕES DE RECURSOS
CREATE OR REPLACE FUNCTION public.check_resource_permission(
  p_user_id UUID,
  p_resource_type TEXT,
  p_resource_id UUID,
  p_action TEXT
)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_has_permission BOOLEAN := FALSE;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  CASE p_resource_type
    WHEN 'user_rankings' THEN
      SELECT EXISTS (
        SELECT 1 FROM public.user_rankings
        WHERE id = p_resource_id AND user_id = p_user_id
      ) INTO v_has_permission;
      
    WHEN 'user_study_v2' THEN
      SELECT EXISTS (
        SELECT 1 FROM public.user_study_v2
        WHERE id = p_resource_id AND user_id = p_user_id
      ) INTO v_has_permission;
      
    WHEN 'concursos' THEN
      IF p_action = 'read' THEN
        v_has_permission := TRUE;
      ELSE
        SELECT EXISTS (
          SELECT 1 FROM public.concursos
          WHERE id = p_resource_id AND created_by = p_user_id
        ) INTO v_has_permission;
      END IF;
      
    ELSE
      v_has_permission := FALSE;
  END CASE;
  
  INSERT INTO public.audit_logs (
    user_id,
    action,
    resource_type,
    resource_id,
    severity,
    status
  ) VALUES (
    p_user_id,
    p_action || '_' || p_resource_type,
    p_resource_type,
    p_resource_id,
    CASE WHEN v_has_permission THEN 'low' ELSE 'high' END,
    CASE WHEN v_has_permission THEN 'success' ELSE 'blocked' END
  );
  
  RETURN v_has_permission;
END;
$$;

-- 5. FUNÇÃO DE VALIDAÇÃO DE ENTRADA SEGURA
CREATE OR REPLACE FUNCTION public.validate_input_security(
  p_input TEXT,
  p_max_length INTEGER DEFAULT 1000
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_result JSONB;
  v_is_valid BOOLEAN := TRUE;
  v_reasons TEXT[] := ARRAY[]::TEXT[];
BEGIN
  IF LENGTH(p_input) > p_max_length THEN
    v_is_valid := FALSE;
    v_reasons := array_append(v_reasons, 'Input excede tamanho máximo permitido');
  END IF;
  
  IF p_input ~* '(\bDROP\b|\bDELETE\b|\bUNION\b|\bINSERT\b|\bUPDATE\b).*(\bTABLE\b|\bFROM\b|\bINTO\b)' THEN
    v_is_valid := FALSE;
    v_reasons := array_append(v_reasons, 'Detectado padrão potencialmente malicioso');
  END IF;
  
  IF p_input ~* '<script[^>]*>.*</script>|javascript:|onerror=|onload=' THEN
    v_is_valid := FALSE;
    v_reasons := array_append(v_reasons, 'Detectado potencial ataque XSS');
  END IF;
  
  IF p_input ~ '\x00' THEN
    v_is_valid := FALSE;
    v_reasons := array_append(v_reasons, 'Caracteres nulos não permitidos');
  END IF;
  
  v_result := jsonb_build_object(
    'is_valid', v_is_valid,
    'reasons', v_reasons,
    'sanitized', regexp_replace(p_input, '[<>]', '', 'g')
  );
  
  RETURN v_result;
END;
$$;

-- 6. FUNÇÃO DE RATE LIMITING
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_user_id UUID,
  p_action TEXT,
  p_max_requests INTEGER DEFAULT 100,
  p_time_window_seconds INTEGER DEFAULT 60
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_request_count INTEGER;
  v_allowed BOOLEAN;
  v_retry_after INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO v_request_count
  FROM public.audit_logs
  WHERE user_id = p_user_id
    AND action = p_action
    AND created_at > NOW() - (p_time_window_seconds || ' seconds')::INTERVAL;
  
  v_allowed := v_request_count < p_max_requests;
  v_retry_after := CASE 
    WHEN v_allowed THEN 0 
    ELSE p_time_window_seconds 
  END;
  
  RETURN jsonb_build_object(
    'allowed', v_allowed,
    'request_count', v_request_count,
    'max_requests', p_max_requests,
    'retry_after', v_retry_after
  );
END;
$$;

-- 7. ATUALIZAR RLS POLICIES EXISTENTES COM RATE LIMITING
DROP POLICY IF EXISTS "Users can insert their own rankings" ON public.user_rankings;
DROP POLICY IF EXISTS "Users can update their own rankings" ON public.user_rankings;

CREATE POLICY "Users can insert their own rankings"
  ON public.user_rankings FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND public.check_rate_limit(auth.uid(), 'insert_user_rankings', 50, 60)->>'allowed' = 'true'
  );

CREATE POLICY "Users can update their own rankings"
  ON public.user_rankings FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND public.check_rate_limit(auth.uid(), 'update_user_rankings', 100, 60)->>'allowed' = 'true'
  );

DROP POLICY IF EXISTS "Users can insert their own study sessions" ON public.user_study_v2;
DROP POLICY IF EXISTS "Users can update their own study sessions" ON public.user_study_v2;

CREATE POLICY "Users can insert their own study sessions"
  ON public.user_study_v2 FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND public.check_rate_limit(auth.uid(), 'insert_user_study', 200, 60)->>'allowed' = 'true'
  );

CREATE POLICY "Users can update their own study sessions"
  ON public.user_study_v2 FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 8. TRIGGERS DE AUDITORIA
DROP TRIGGER IF EXISTS audit_user_rankings_trigger ON public.user_rankings;
CREATE TRIGGER audit_user_rankings_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.user_rankings
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

DROP TRIGGER IF EXISTS audit_user_study_trigger ON public.user_study_v2;
CREATE TRIGGER audit_user_study_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.user_study_v2
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

-- 9. FUNÇÕES DE MANUTENÇÃO
CREATE OR REPLACE FUNCTION public.cleanup_expired_tokens()
RETURNS INTEGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  DELETE FROM public.secure_tokens
  WHERE expires_at < NOW()
    AND revoked_at IS NULL;
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  
  RETURN v_deleted_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_old_audit_logs(
  p_retention_days INTEGER DEFAULT 90
)
RETURNS INTEGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  DELETE FROM public.audit_logs
  WHERE created_at < NOW() - (p_retention_days || ' days')::INTERVAL
    AND severity IN ('low', 'medium');
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  
  RETURN v_deleted_count;
END;
$$;

-- COMENTÁRIOS
COMMENT ON TABLE public.secure_tokens IS 'Tokens de autenticação seguros com controle de expiração';
COMMENT ON TABLE public.audit_logs IS 'Logs de auditoria para compliance e segurança';
COMMENT ON FUNCTION public.check_resource_permission IS 'Valida permissões de usuário para recursos';
COMMENT ON FUNCTION public.validate_input_security IS 'Valida entrada contra SQLi e XSS';
COMMENT ON FUNCTION public.check_rate_limit IS 'Rate limiting no nível do banco';