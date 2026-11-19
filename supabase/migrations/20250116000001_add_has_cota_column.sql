-- Add has_cota JSONB column to concursos table
ALTER TABLE concursos 
ADD COLUMN has_cota JSONB DEFAULT '{}'::jsonb;

-- Add comment to document the structure
COMMENT ON COLUMN concursos.has_cota IS 'JSONB structure for quota configuration: {ppp: boolean, pcd: boolean, ind: boolean, hip: boolean, tra: boolean, min_cota: number}';

-- Create index for better performance on JSONB queries
CREATE INDEX idx_concursos_has_cota ON concursos USING GIN (has_cota);













