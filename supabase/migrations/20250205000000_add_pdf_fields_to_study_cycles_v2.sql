-- Migration: Add PDF fields to study_cycles_v2
-- Adiciona campos para armazenar URLs dos PDFs de trilha semanal e subjetiva

-- Adicionar colunas para PDFs
ALTER TABLE public.study_cycles_v2 
ADD COLUMN IF NOT EXISTS trilha_semanal_pdf_url TEXT,
ADD COLUMN IF NOT EXISTS subjetiva_pdf_url TEXT;

-- Comentários para documentação
COMMENT ON COLUMN public.study_cycles_v2.trilha_semanal_pdf_url IS 
'URL pública do PDF da trilha semanal do ciclo de estudos. Armazenado no Supabase Storage.';

COMMENT ON COLUMN public.study_cycles_v2.subjetiva_pdf_url IS 
'URL pública do PDF da subjetiva do ciclo de estudos. Armazenado no Supabase Storage.';

