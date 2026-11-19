-- Adicionar campos de mínimo global à tabela concursos
-- Implementação segura com validação

-- 1. Adicionar campos de mínimo global
ALTER TABLE concursos 
ADD COLUMN IF NOT EXISTS has_minimum_score boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS total_minimum_score numeric DEFAULT 0;

-- 2. Adicionar comentários explicativos
COMMENT ON COLUMN concursos.has_minimum_score IS 'Indica se o concurso tem pontuação mínima global obrigatória';
COMMENT ON COLUMN concursos.total_minimum_score IS 'Pontuação mínima global que o candidato deve atingir para não ser eliminado';

-- 3. Atualizar comentário da tabela
COMMENT ON TABLE concursos IS 'Tabela de concursos com regras de mínimo global, por bloco, por disciplina e por cota';

-- 4. Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_concursos_minimum_score 
ON concursos(has_minimum_score, total_minimum_score) 
WHERE has_minimum_score = true;

-- 5. Log da implementação
INSERT INTO score_calculation_logs (user_ranking_id, calculation_type, calculation_details)
VALUES (
    '00000000-0000-0000-0000-000000000000'::uuid, 
    'add_global_minimum_fields', 
    jsonb_build_object(
        'message', 'Adicionados campos has_minimum_score e total_minimum_score à tabela concursos',
        'timestamp', NOW(),
        'version', '1.0',
        'safe_implementation', true
    )
);

-- 6. Validação: Verificar se os campos foram adicionados corretamente
DO $$
DECLARE
    has_minimum_score_exists boolean := false;
    total_minimum_score_exists boolean := false;
BEGIN
    -- Verificar se has_minimum_score existe
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'concursos' 
        AND column_name = 'has_minimum_score'
    ) INTO has_minimum_score_exists;
    
    -- Verificar se total_minimum_score existe
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'concursos' 
        AND column_name = 'total_minimum_score'
    ) INTO total_minimum_score_exists;
    
    IF has_minimum_score_exists AND total_minimum_score_exists THEN
        RAISE NOTICE '✅ SUCESSO: Campos de mínimo global adicionados com sucesso';
        RAISE NOTICE '   has_minimum_score: %', has_minimum_score_exists;
        RAISE NOTICE '   total_minimum_score: %', total_minimum_score_exists;
    ELSE
        RAISE NOTICE '❌ ERRO: Falha ao adicionar campos de mínimo global';
        RAISE NOTICE '   has_minimum_score: %', has_minimum_score_exists;
        RAISE NOTICE '   total_minimum_score: %', total_minimum_score_exists;
    END IF;
END $$;




