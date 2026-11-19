-- Adicionar campos para seção "Outro" subjetiva
ALTER TABLE concursos 
ADD COLUMN has_other_subjective BOOLEAN DEFAULT FALSE,
ADD COLUMN other_subjective_name TEXT,
ADD COLUMN other_subjective_weight INTEGER DEFAULT 1;

-- Comentários para documentação
COMMENT ON COLUMN concursos.has_other_subjective IS 'Indica se o concurso possui uma seção subjetiva personalizada (Outro)';
COMMENT ON COLUMN concursos.other_subjective_name IS 'Nome personalizado da seção subjetiva (ex: Prova Prática, Redação)';
COMMENT ON COLUMN concursos.other_subjective_weight IS 'Peso da seção subjetiva personalizada no cálculo da nota final';



