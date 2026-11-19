-- Migration: Adicionar suporte para documentos de estudo (study_document)
-- Objetivo: Permitir tokens seguros para documentos de estudo

-- 1. Atualizar constraint para incluir 'study_document'
ALTER TABLE public.secure_url_tokens
DROP CONSTRAINT IF EXISTS secure_url_tokens_entity_type_check;

ALTER TABLE public.secure_url_tokens
ADD CONSTRAINT secure_url_tokens_entity_type_check 
CHECK (entity_type IN ('user', 'concurso', 'community', 'study_cycle', 'admin', 'edit', 'study_document'));

-- Nota: Os filePaths são armazenados no JSONB study_cycles dentro de user_study_v2
-- Não é necessário criar colunas separadas, pois os dados são armazenados dinamicamente no JSONB

