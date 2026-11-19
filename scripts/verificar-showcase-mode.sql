-- Script para verificar o modo vitrine (showcase)
-- Execute este script no Supabase SQL Editor

-- 1. Verificar se o campo existe
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'concursos' 
  AND column_name = 'is_showcase';

-- 2. Verificar rankings "Nomeia Aí" e seus cargos
SELECT 
  id,
  titulo,
  is_general_card,
  parent_concurso_id,
  is_showcase,
  cargo
FROM concursos
WHERE titulo ILIKE '%Nomeia Aí%' 
   OR titulo ILIKE '%nomeia%'
ORDER BY is_general_card DESC, cargo;

-- 3. Verificar todos os rankings em modo vitrine
SELECT 
  id,
  titulo,
  is_general_card,
  parent_concurso_id,
  is_showcase,
  cargo
FROM concursos
WHERE is_showcase = true;

-- 4. Verificar cargos de um card geral específico (substitua o ID)
-- SELECT 
--   id,
--   titulo,
--   is_general_card,
--   parent_concurso_id,
--   is_showcase,
--   cargo
-- FROM concursos
-- WHERE parent_concurso_id = 'SEU_ID_AQUI';
