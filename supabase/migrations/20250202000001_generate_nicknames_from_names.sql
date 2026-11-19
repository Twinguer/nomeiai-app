-- ============================================
-- Migration: Gerar Nicknames dos Nomes dos Usuários Existentes
-- Data: 2025-02-02
-- Objetivo: Gerar nicknames baseados nos nomes dos usuários existentes
-- ============================================

-- Atualizar todos os usuários existentes: gerar nickname baseado no nome
UPDATE users_profiles
SET nickname = generate_unique_nickname(COALESCE(name, email))
WHERE nickname IS NULL 
   OR TRIM(nickname) = ''
   OR nickname NOT SIMILAR TO '^[a-z0-9_]{3,20}$';

-- Se ainda houver duplicados após a geração, corrigir
DO $$
DECLARE
  user_rec RECORD;
  new_nickname TEXT;
BEGIN
  FOR user_rec IN 
    SELECT id, nickname, name, email, created_at
    FROM users_profiles
    WHERE nickname IS NOT NULL
    ORDER BY created_at
  LOOP
    -- Se nickname já existe em outro usuário (mais antigo)
    IF EXISTS (
      SELECT 1 FROM users_profiles 
      WHERE LOWER(nickname) = LOWER(user_rec.nickname)
      AND id != user_rec.id
      AND created_at < user_rec.created_at
    ) THEN
      -- Gerar novo nickname único baseado no nome
      new_nickname := generate_unique_nickname(
        COALESCE(user_rec.name, user_rec.email)
      );
      
      -- Atualizar com novo nickname
      UPDATE users_profiles
      SET nickname = new_nickname
      WHERE id = user_rec.id;
    END IF;
  END LOOP;
END;
$$;

-- Garantir que todos os nicknames estão em minúsculas e sem espaços
UPDATE users_profiles
SET nickname = LOWER(TRIM(REGEXP_REPLACE(nickname, '[^a-z0-9_]', '', 'g')))
WHERE nickname IS NOT NULL;

-- Garantir que todos os usuários têm nickname válido
UPDATE users_profiles
SET nickname = generate_unique_nickname(COALESCE(name, email))
WHERE nickname IS NULL 
   OR LENGTH(TRIM(nickname)) < 3
   OR nickname !~ '^[a-z0-9_]{3,20}$';

