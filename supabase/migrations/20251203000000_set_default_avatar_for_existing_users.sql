-- Atualizar usuários existentes sem avatar para usar o avatar padrão
-- Esta migration define o avatar padrão (imagem do usuário @nomeiai) para todos os usuários que ainda não têm uma foto de perfil

UPDATE public.users_profiles
SET 
  avatar_url = 'https://ppsymqrdtjyaguftracc.supabase.co/storage/v1/object/public/profiles/ee17d498-b633-419f-90bd-0cad82166804-1762810011516.png',
  updated_at = NOW()
WHERE 
  avatar_url IS NULL OR avatar_url = '/images/default-avatar.png';

-- Log da quantidade de usuários atualizados
DO $$
DECLARE
  v_updated_count INTEGER;
BEGIN
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RAISE NOTICE 'Atualizados % usuários com avatar padrão', v_updated_count;
END $$;

