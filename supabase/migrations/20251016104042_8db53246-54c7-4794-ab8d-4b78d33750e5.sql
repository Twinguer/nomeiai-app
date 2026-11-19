-- Reverter mudanças na estrutura da tabela user_rankings
-- Voltar para estrutura original: 1 usuário = 1 tupla com todos os rankings em JSONB

-- 1. Remover RLS policies criadas
DROP POLICY IF EXISTS "Anyone can view rankings" ON user_rankings;
DROP POLICY IF EXISTS "Users can insert own ranking" ON user_rankings;
DROP POLICY IF EXISTS "Users can update own ranking" ON user_rankings;
DROP POLICY IF EXISTS "Users can delete own ranking" ON user_rankings;

-- 2. Desabilitar RLS
ALTER TABLE user_rankings DISABLE ROW LEVEL SECURITY;

-- 3. Remover trigger
DROP TRIGGER IF EXISTS trigger_user_rankings_updated_at ON user_rankings;
DROP FUNCTION IF EXISTS update_user_rankings_updated_at();

-- 4. Remover constraint foreign key
ALTER TABLE user_rankings DROP CONSTRAINT IF EXISTS fk_user_rankings_concurso;

-- 5. Remover índices criados
DROP INDEX IF EXISTS idx_user_rankings_concurso;
DROP INDEX IF EXISTS idx_user_rankings_score;
DROP INDEX IF EXISTS idx_user_rankings_reservation;
DROP INDEX IF EXISTS idx_user_rankings_user;
DROP INDEX IF EXISTS idx_user_rankings_booklet;
DROP INDEX IF EXISTS idx_user_rankings_consolidated_data;

-- 6. Remover colunas desnormalizadas
ALTER TABLE user_rankings DROP COLUMN IF EXISTS concurso_id;
ALTER TABLE user_rankings DROP COLUMN IF EXISTS score;
ALTER TABLE user_rankings DROP COLUMN IF EXISTS reservation_type;
ALTER TABLE user_rankings DROP COLUMN IF EXISTS selected_booklet_id;
ALTER TABLE user_rankings DROP COLUMN IF EXISTS created_at;
ALTER TABLE user_rankings DROP COLUMN IF EXISTS updated_at;

-- 7. Garantir que a estrutura original está intacta
-- A tabela deve ter apenas: user_id (PK) e consolidated_data (JSONB)
-- Estrutura do consolidated_data:
-- {
--   "rankings": {
--     "ranking_id_1": {
--       "concurso_id": "uuid",
--       "user_data": { "score": 0, "reservation_type": "...", ... },
--       "metadata": { ... }
--     },
--     "ranking_id_2": { ... }
--   }
-- }