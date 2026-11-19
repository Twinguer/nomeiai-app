-- =====================================================
-- MIGRATION: Criar RPCs de validação de tokens no backend
-- OBJETIVO: Mover validação de tokens do frontend para backend
-- DATA: 2025-01-20
-- =====================================================
-- 
-- ⚠️ SEGURANÇA: Esta migration cria RPCs que validam tokens no backend,
-- eliminando a necessidade de expor a chave de ofuscação no frontend.
-- 
-- A chave de ofuscação deve ser configurada como variável de ambiente
-- no Supabase: OBFUSCATION_KEY
-- =====================================================

-- Função helper para obter chave de ofuscação
-- Usa variável de ambiente do Supabase ou fallback seguro
CREATE OR REPLACE FUNCTION get_obfuscation_key()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_key TEXT;
BEGIN
  -- Tentar obter da variável de ambiente do Supabase
  BEGIN
    v_key := current_setting('app.obfuscation_key', true);
    IF v_key IS NOT NULL AND v_key != '' THEN
      RETURN v_key;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Variável não configurada, continuar
    NULL;
  END;
  
  -- Se não encontrou, usar chave padrão (DEVE SER ALTERADA EM PRODUÇÃO)
  -- ⚠️ IMPORTANTE: Configure a variável de ambiente 'app.obfuscation_key' no Supabase
  RETURN 'default_obfuscation_key_change_in_production';
END;
$$;

COMMENT ON FUNCTION get_obfuscation_key() IS 'Obtém chave de ofuscação de variável de ambiente. Configure app.obfuscation_key no Supabase.';

-- =====================================================
-- RPC: Validar token de usuário
-- =====================================================
CREATE OR REPLACE FUNCTION validate_user_token(p_token TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_decoded TEXT;
  v_parts TEXT[];
  v_user_id UUID;
  v_timestamp BIGINT;
  v_key TEXT;
  v_token_age BIGINT;
  v_max_age BIGINT := 24 * 60 * 60 * 1000; -- 24 horas em milissegundos
  v_user_exists BOOLEAN;
BEGIN
  -- Validar entrada
  IF p_token IS NULL OR p_token = '' THEN
    RETURN NULL;
  END IF;
  
  -- Decodificar token (base64)
  BEGIN
    -- PostgreSQL não tem atob nativo, então vamos usar uma abordagem diferente
    -- O token vem como base64, precisamos decodificar
    -- Por enquanto, vamos assumir que o frontend envia o token já decodificado
    -- ou vamos usar uma função de decodificação
    
    -- Para simplificar, vamos receber o token já decodificado do frontend
    -- ou criar uma função de decodificação base64
    -- Por enquanto, vamos usar uma abordagem onde o frontend envia partes separadas
    
    -- Alternativa: usar pgcrypto para decodificar
    -- Mas para manter compatibilidade, vamos receber o token e validar estrutura
    
    -- Por enquanto, vamos fazer uma validação básica
    -- O frontend deve enviar o token completo e nós validamos aqui
    
    -- Decodificar usando função auxiliar (se necessário)
    -- Por enquanto, assumimos que o token vem em formato que podemos processar
    
    RETURN NULL; -- Placeholder - precisa implementar decodificação base64
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;
END;
$$;

-- Como PostgreSQL não tem atob nativo, vamos criar uma abordagem diferente:
-- O frontend enviará o token decodificado ou usaremos uma função de decodificação

-- Função auxiliar para decodificar base64 (simplificada)
CREATE OR REPLACE FUNCTION base64_decode(p_encoded TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_decoded BYTEA;
BEGIN
  -- PostgreSQL tem decode() para base64
  BEGIN
    v_decoded := decode(p_encoded, 'base64');
    RETURN convert_from(v_decoded, 'UTF8');
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;
END;
$$;

-- Agora vamos recriar a função de validação de token de usuário
DROP FUNCTION IF EXISTS validate_user_token(TEXT);

CREATE OR REPLACE FUNCTION validate_user_token(p_token TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_decoded TEXT;
  v_parts TEXT[];
  v_user_id UUID;
  v_timestamp BIGINT;
  v_key TEXT;
  v_token_age BIGINT;
  v_max_age BIGINT := 24 * 60 * 60 * 1000; -- 24 horas
  v_obfuscation_key TEXT;
BEGIN
  -- Validar entrada
  IF p_token IS NULL OR p_token = '' THEN
    RETURN NULL;
  END IF;
  
  -- Decodificar token base64
  v_decoded := base64_decode(p_token);
  IF v_decoded IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Separar partes (formato: userId:timestamp:key)
  v_parts := string_to_array(v_decoded, ':');
  IF array_length(v_parts, 1) != 3 THEN
    RETURN NULL;
  END IF;
  
  -- Extrair componentes
  BEGIN
    v_user_id := v_parts[1]::UUID;
    v_timestamp := v_parts[2]::BIGINT;
    v_key := v_parts[3];
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;
  
  -- Obter chave de ofuscação do backend
  v_obfuscation_key := get_obfuscation_key();
  
  -- Validar chave
  IF v_key != v_obfuscation_key THEN
    RETURN NULL;
  END IF;
  
  -- Verificar expiração (timestamp em milissegundos)
  -- Converter NOW() para milissegundos Unix timestamp
  v_token_age := (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT - v_timestamp;
  IF v_token_age > v_max_age THEN
    RETURN NULL;
  END IF;
  
  -- Verificar se usuário existe
  SELECT EXISTS(SELECT 1 FROM users_profiles WHERE id = v_user_id) INTO v_user_exists;
  IF NOT v_user_exists THEN
    RETURN NULL;
  END IF;
  
  RETURN v_user_id;
END;
$$;

COMMENT ON FUNCTION validate_user_token(TEXT) IS 'Valida token de usuário no backend. Retorna UUID do usuário se válido, NULL caso contrário.';

-- =====================================================
-- RPC: Validar token de concurso
-- =====================================================
CREATE OR REPLACE FUNCTION validate_concurso_token(p_token TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_decoded TEXT;
  v_parts TEXT[];
  v_concurso_id UUID;
  v_timestamp BIGINT;
  v_key TEXT;
  v_token_age BIGINT;
  v_max_age BIGINT := 24 * 60 * 60 * 1000;
  v_obfuscation_key TEXT;
  v_concurso_exists BOOLEAN;
BEGIN
  IF p_token IS NULL OR p_token = '' THEN
    RETURN NULL;
  END IF;
  
  v_decoded := base64_decode(p_token);
  IF v_decoded IS NULL THEN
    RETURN NULL;
  END IF;
  
  v_parts := string_to_array(v_decoded, ':');
  IF array_length(v_parts, 1) != 3 THEN
    RETURN NULL;
  END IF;
  
  BEGIN
    v_concurso_id := v_parts[1]::UUID;
    v_timestamp := v_parts[2]::BIGINT;
    v_key := v_parts[3];
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;
  
  v_obfuscation_key := get_obfuscation_key();
  
  IF v_key != v_obfuscation_key THEN
    RETURN NULL;
  END IF;
  
  v_token_age := EXTRACT(EPOCH FROM (NOW() * 1000))::BIGINT - v_timestamp;
  IF v_token_age > v_max_age THEN
    RETURN NULL;
  END IF;
  
  SELECT EXISTS(SELECT 1 FROM concursos WHERE id = v_concurso_id) INTO v_concurso_exists;
  IF NOT v_concurso_exists THEN
    RETURN NULL;
  END IF;
  
  RETURN v_concurso_id;
END;
$$;

COMMENT ON FUNCTION validate_concurso_token(TEXT) IS 'Valida token de concurso no backend. Retorna UUID do concurso se válido, NULL caso contrário.';

-- =====================================================
-- RPC: Validar token de ciclo de estudo
-- =====================================================
CREATE OR REPLACE FUNCTION validate_study_cycle_token(p_token TEXT, p_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_decoded TEXT;
  v_parts TEXT[];
  v_cycle_id UUID;
  v_token_user_id UUID;
  v_timestamp BIGINT;
  v_key TEXT;
  v_token_age BIGINT;
  v_max_age BIGINT := 24 * 60 * 60 * 1000;
  v_obfuscation_key TEXT;
  v_cycle_exists BOOLEAN;
BEGIN
  IF p_token IS NULL OR p_token = '' OR p_user_id IS NULL THEN
    RETURN NULL;
  END IF;
  
  v_decoded := base64_decode(p_token);
  IF v_decoded IS NULL THEN
    RETURN NULL;
  END IF;
  
  v_parts := string_to_array(v_decoded, ':');
  IF array_length(v_parts, 1) != 4 THEN
    RETURN NULL;
  END IF;
  
  BEGIN
    v_cycle_id := v_parts[1]::UUID;
    v_token_user_id := v_parts[2]::UUID;
    v_timestamp := v_parts[3]::BIGINT;
    v_key := v_parts[4];
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;
  
  -- Verificar se o token pertence ao usuário
  IF v_token_user_id != p_user_id THEN
    RETURN NULL;
  END IF;
  
  v_obfuscation_key := get_obfuscation_key();
  
  IF v_key != v_obfuscation_key THEN
    RETURN NULL;
  END IF;
  
  v_token_age := EXTRACT(EPOCH FROM (NOW() * 1000))::BIGINT - v_timestamp;
  IF v_token_age > v_max_age THEN
    RETURN NULL;
  END IF;
  
  -- Verificar se ciclo existe e está ativo
  SELECT EXISTS(
    SELECT 1 FROM user_study_v2 
    WHERE id = v_cycle_id 
    AND user_id = p_user_id
    AND is_active = true
  ) INTO v_cycle_exists;
  
  IF NOT v_cycle_exists THEN
    RETURN NULL;
  END IF;
  
  RETURN v_cycle_id;
END;
$$;

COMMENT ON FUNCTION validate_study_cycle_token(TEXT, UUID) IS 'Valida token de ciclo de estudo no backend. Retorna UUID do ciclo se válido, NULL caso contrário.';

-- =====================================================
-- RPC: Validar token de comunidade
-- =====================================================
CREATE OR REPLACE FUNCTION validate_community_token(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_decoded TEXT;
  v_parts TEXT[];
  v_user_id UUID;
  v_action TEXT;
  v_timestamp BIGINT;
  v_key TEXT;
  v_token_age BIGINT;
  v_max_age BIGINT := 24 * 60 * 60 * 1000;
  v_obfuscation_key TEXT;
  v_user_exists BOOLEAN;
BEGIN
  IF p_token IS NULL OR p_token = '' THEN
    RETURN NULL;
  END IF;
  
  v_decoded := base64_decode(p_token);
  IF v_decoded IS NULL THEN
    RETURN NULL;
  END IF;
  
  v_parts := string_to_array(v_decoded, ':');
  IF array_length(v_parts, 1) != 4 THEN
    RETURN NULL;
  END IF;
  
  BEGIN
    v_user_id := v_parts[1]::UUID;
    v_action := v_parts[2];
    v_timestamp := v_parts[3]::BIGINT;
    v_key := v_parts[4];
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END IF;
  
  v_obfuscation_key := get_obfuscation_key();
  
  IF v_key != v_obfuscation_key THEN
    RETURN NULL;
  END IF;
  
  v_token_age := EXTRACT(EPOCH FROM (NOW() * 1000))::BIGINT - v_timestamp;
  IF v_token_age > v_max_age THEN
    RETURN NULL;
  END IF;
  
  SELECT EXISTS(SELECT 1 FROM users_profiles WHERE id = v_user_id) INTO v_user_exists;
  IF NOT v_user_exists THEN
    RETURN NULL;
  END IF;
  
  RETURN jsonb_build_object(
    'user_id', v_user_id,
    'action', v_action
  );
END;
$$;

COMMENT ON FUNCTION validate_community_token(TEXT) IS 'Valida token de comunidade no backend. Retorna JSONB com user_id e action se válido, NULL caso contrário.';

-- =====================================================
-- RPC: Validar token de admin
-- =====================================================
CREATE OR REPLACE FUNCTION validate_admin_token(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_decoded TEXT;
  v_parts TEXT[];
  v_admin_id UUID;
  v_resource TEXT;
  v_timestamp BIGINT;
  v_key TEXT;
  v_token_age BIGINT;
  v_max_age BIGINT := 24 * 60 * 60 * 1000;
  v_obfuscation_key TEXT;
  v_is_admin BOOLEAN;
BEGIN
  IF p_token IS NULL OR p_token = '' THEN
    RETURN NULL;
  END IF;
  
  v_decoded := base64_decode(p_token);
  IF v_decoded IS NULL THEN
    RETURN NULL;
  END IF;
  
  v_parts := string_to_array(v_decoded, ':');
  IF array_length(v_parts, 1) != 4 THEN
    RETURN NULL;
  END IF;
  
  BEGIN
    v_admin_id := v_parts[1]::UUID;
    v_resource := v_parts[2];
    v_timestamp := v_parts[3]::BIGINT;
    v_key := v_parts[4];
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END IF;
  
  v_obfuscation_key := get_obfuscation_key();
  
  IF v_key != v_obfuscation_key THEN
    RETURN NULL;
  END IF;
  
  v_token_age := EXTRACT(EPOCH FROM (NOW() * 1000))::BIGINT - v_timestamp;
  IF v_token_age > v_max_age THEN
    RETURN NULL;
  END IF;
  
  -- Verificar se usuário é admin
  SELECT COALESCE(is_admin, false) INTO v_is_admin
  FROM users_profiles
  WHERE id = v_admin_id;
  
  IF NOT v_is_admin THEN
    RETURN NULL;
  END IF;
  
  RETURN jsonb_build_object(
    'admin_id', v_admin_id,
    'resource', v_resource
  );
END;
$$;

COMMENT ON FUNCTION validate_admin_token(TEXT) IS 'Valida token de admin no backend. Retorna JSONB com admin_id e resource se válido, NULL caso contrário.';

-- =====================================================
-- Conceder permissões
-- =====================================================
GRANT EXECUTE ON FUNCTION validate_user_token(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION validate_concurso_token(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION validate_study_cycle_token(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION validate_community_token(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION validate_admin_token(TEXT) TO authenticated;

