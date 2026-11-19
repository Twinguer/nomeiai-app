-- =====================================================
-- Configurar chave de ofuscação via tabela app_config
-- =====================================================
-- Como o Supabase não tem "Custom Config" no dashboard,
-- vamos usar uma tabela para armazenar a chave

-- Criar tabela para configurações da aplicação (se não existir)
CREATE TABLE IF NOT EXISTS app_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Atualizar função get_obfuscation_key para ler da tabela
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
  -- Tentar obter da tabela app_config primeiro
  SELECT value INTO v_key
  FROM app_config
  WHERE key = 'obfuscation_key';
  
  IF v_key IS NOT NULL AND v_key != '' AND v_key != 'default_obfuscation_key_change_in_production' THEN
    RETURN v_key;
  END IF;
  
  -- Tentar obter da variável de ambiente do Supabase (se configurada)
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
  -- ⚠️ IMPORTANTE: Execute SELECT update_obfuscation_key('sua_chave'); para configurar
  RETURN 'default_obfuscation_key_change_in_production';
END;
$$;

-- Remover função antiga se existir (caso tenha tipo de retorno diferente)
DROP FUNCTION IF EXISTS update_obfuscation_key(TEXT);

-- Função para atualizar a chave
CREATE OR REPLACE FUNCTION update_obfuscation_key(p_key TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_key IS NULL OR length(p_key) < 32 THEN
    RAISE EXCEPTION 'Chave de ofuscação deve ter pelo menos 32 caracteres';
  END IF;
  
  -- Atualizar na tabela
  INSERT INTO app_config (key, value, description)
  VALUES ('obfuscation_key', p_key, 'Chave de ofuscação para validação de tokens')
  ON CONFLICT (key) 
  DO UPDATE SET 
    value = EXCLUDED.value,
    updated_at = NOW();
  
  RETURN format('✅ Chave atualizada com sucesso. Preview: %s...', left(p_key, 20));
END;
$$;

-- Remover função antiga se existir (caso tenha tipo de retorno diferente)
DROP FUNCTION IF EXISTS get_obfuscation_key_status();

-- Função para verificar status
CREATE OR REPLACE FUNCTION get_obfuscation_key_status()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key TEXT;
  v_status JSONB;
BEGIN
  v_key := get_obfuscation_key();
  
  v_status := jsonb_build_object(
    'configured', v_key != 'default_obfuscation_key_change_in_production',
    'key_preview', CASE 
      WHEN v_key != 'default_obfuscation_key_change_in_production' 
      THEN left(v_key, 10) || '...' 
      ELSE 'NOT CONFIGURED' 
    END,
    'message', CASE
      WHEN v_key = 'default_obfuscation_key_change_in_production'
      THEN '⚠️ Execute: SELECT update_obfuscation_key(''sua_chave_aqui'');'
      ELSE '✅ Chave configurada'
    END
  );
  
  RETURN v_status;
END;
$$;

-- Conceder permissões
GRANT SELECT ON app_config TO authenticated, anon;
GRANT EXECUTE ON FUNCTION update_obfuscation_key(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_obfuscation_key_status() TO authenticated, anon;

-- Comentários
COMMENT ON TABLE app_config IS 'Armazena configurações da aplicação, incluindo chave de ofuscação';
COMMENT ON FUNCTION get_obfuscation_key() IS 'Obtém chave de ofuscação da tabela app_config ou variável de ambiente';
COMMENT ON FUNCTION update_obfuscation_key(TEXT) IS 'Atualiza a chave de ofuscação na tabela app_config';
COMMENT ON FUNCTION get_obfuscation_key_status() IS 'Verifica status da configuração da chave de ofuscação';

