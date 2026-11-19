-- =====================================================
-- MIGRATION: Função para executar SQL dinamicamente
-- OBJETIVO: Permitir execução de migrations via RPC
-- DATA: 2025-01-15
-- =====================================================

-- Função para executar SQL dinamicamente (apenas para migrations)
CREATE OR REPLACE FUNCTION exec_sql(sql TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result TEXT;
BEGIN
  -- Executar o SQL fornecido
  EXECUTE sql;
  
  -- Retornar sucesso
  result := 'SQL executado com sucesso';
  
  RETURN result;
EXCEPTION
  WHEN OTHERS THEN
    -- Retornar erro
    result := 'Erro: ' || SQLERRM;
    RETURN result;
END;
$$;

-- Comentário da função
COMMENT ON FUNCTION exec_sql(TEXT) IS 'Função para executar SQL dinamicamente - uso restrito para migrations';
