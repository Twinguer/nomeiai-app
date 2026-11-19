-- Adicionar política pública de leitura para coach_profiles
-- Permite que todos os usuários autenticados vejam quais usuários são coaches
-- Isso é necessário para exibir o badge "Coach" nos cards de perfil

CREATE POLICY "Public can view coach profiles"
ON coach_profiles
FOR SELECT
TO public
USING (true);

