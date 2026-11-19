-- Permitir visualização pública de rankings para listas de classificação e perfis
-- Mantém restrições de INSERT, UPDATE e DELETE apenas para o próprio usuário

-- Remove política restritiva de SELECT (apenas próprio usuário)
DROP POLICY IF EXISTS "secure_users_view_own_rankings" ON user_rankings;

-- Adiciona política que permite visualização pública de rankings
-- Qualquer usuário autenticado pode ver rankings de todos para:
-- 1. Listas de classificação públicas
-- 2. Perfis públicos de usuários
-- 3. Comparações e estatísticas
CREATE POLICY "public_can_view_all_rankings"
ON user_rankings
FOR SELECT
USING (true);

-- Adiciona comentário explicativo
COMMENT ON POLICY "public_can_view_all_rankings" ON user_rankings IS 
'Permite visualização pública de rankings para listas de classificação e perfis públicos. 
INSERT, UPDATE e DELETE permanecem restritos ao próprio usuário.';