-- Migration: Adicionar campo watermark_image_url na tabela concursos
-- Permite armazenar URL da imagem de marca d'água para os cards de ranking

ALTER TABLE concursos 
ADD COLUMN IF NOT EXISTS watermark_image_url TEXT;

COMMENT ON COLUMN concursos.watermark_image_url IS 'URL da imagem de marca dágua exibida nos cards de ranking';

