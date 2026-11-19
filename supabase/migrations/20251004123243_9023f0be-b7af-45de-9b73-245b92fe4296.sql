-- Remove a edge function approach e cria um trigger automático para criar perfis de usuário

-- Função para criar perfil automaticamente quando um usuário se registra
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name TEXT;
  v_nickname TEXT;
BEGIN
  v_name := COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1));
  
  -- Se nickname foi fornecido no metadata, usar; senão gerar baseado no nome
  v_nickname := NEW.raw_user_meta_data->>'nickname';
  
  IF v_nickname IS NULL OR TRIM(v_nickname) = '' THEN
    -- Gerar nickname baseado no nome usando a função existente
    v_nickname := generate_unique_nickname(v_name);
  ELSE
    -- Normalizar nickname fornecido
    v_nickname := LOWER(REGEXP_REPLACE(TRIM(v_nickname), '[^a-z0-9_]', '', 'g'));
    
    -- Validar formato
    IF v_nickname !~ '^[a-z0-9_]{3,20}$' THEN
      -- Se inválido, gerar baseado no nome
      v_nickname := generate_unique_nickname(v_name);
    ELSE
      -- Verificar se é único, se não for, gerar novo
      IF EXISTS (SELECT 1 FROM users_profiles WHERE LOWER(nickname) = LOWER(v_nickname)) THEN
        v_nickname := generate_unique_nickname(v_name);
      END IF;
    END IF;
  END IF;
  
  INSERT INTO public.users_profiles (id, email, name, nickname, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    v_name,
    v_nickname,
    NOW(),
    NOW()
  );
  RETURN NEW;
EXCEPTION
  WHEN unique_violation THEN
    -- Perfil já existe, não fazer nada
    RETURN NEW;
  WHEN OTHERS THEN
    -- Log do erro mas não bloqueia o signup
    RAISE WARNING 'Erro ao criar perfil para usuário %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- Remove o trigger antigo se existir
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Cria o trigger que dispara automaticamente após inserção de novo usuário
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();