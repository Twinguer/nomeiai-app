-- Migration: Migrar URLs públicas de documentos para filePath
-- Objetivo: Converter URLs públicas antigas em filePaths para usar sistema seguro
-- 
-- Esta migration extrai o filePath das URLs públicas e atualiza os ciclos
-- para usar o sistema seguro via Edge Function

-- Função para extrair filePath de URL pública
CREATE OR REPLACE FUNCTION extract_filepath_from_url(url TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  filepath TEXT;
BEGIN
  -- Extrair filePath do padrão: /storage/v1/object/public/profiles/{filePath}
  IF url ~ '/storage/v1/object/public/profiles/(.+)$' THEN
    filepath := (regexp_match(url, '/storage/v1/object/public/profiles/(.+)$'))[1];
    RETURN filepath;
  END IF;
  
  RETURN NULL;
END;
$$;

-- Atualizar ciclos que têm URL pública mas não têm filePath
-- Nota: Como study_cycles_v2 não existe como tabela (está em JSONB),
-- esta migration serve apenas como documentação do processo de migração
-- A migração real deve ser feita via código frontend/backend

-- Comentário: Para migrar documentos existentes, use a função migrateLegacyUrlToFilePath
-- no frontend, que será chamada automaticamente quando o usuário clicar em "Ver"

COMMENT ON FUNCTION extract_filepath_from_url(TEXT) IS 
'Extrai o filePath de uma URL pública do Supabase Storage. Usado para migração de documentos antigos.';

