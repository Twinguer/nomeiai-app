-- ============================================
-- STUDY GROUPS - Estrutura Completa
-- Data: 2025-01-28
-- Reutiliza padrões de user_followers e coach_profiles
-- ============================================

-- ============================================
-- 1. TABELA: study_groups
-- ============================================
CREATE TABLE IF NOT EXISTS study_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Informações básicas
  name VARCHAR(255) NOT NULL,
  description TEXT,
  cover_image_url TEXT,
  
  -- Configuração
  privacy_level TEXT NOT NULL DEFAULT 'public' 
    CHECK (privacy_level IN ('public', 'private', 'invite_only')),
  max_members INTEGER DEFAULT 50,
  current_members INTEGER DEFAULT 0,
  
  -- Categorização
  focus_area TEXT, -- 'TJ-SP', 'Receita Federal', etc.
  target_concurso_id UUID REFERENCES concursos(id) ON DELETE SET NULL,
  
  -- Hierarquia
  coach_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Posts em JSONB (seguindo padrão coach_profiles)
  posts_data JSONB DEFAULT '[]'::jsonb,
  /*
  [
    {
      "id": "uuid",
      "author_id": "uuid",
      "content": "texto do post",
      "comments_count": 5,
      "comments": [
        {
          "id": "uuid",
          "author_id": "uuid",
          "content": "texto do comentário",
          "parent_comment_id": null,
          "created_at": "2025-01-15T10:00:00Z"
        }
      ],
      "is_pinned": false,
      "is_deleted": false,
      "expires_at": "2025-04-15T10:00:00Z",
      "created_at": "2025-01-15T10:00:00Z"
    }
  ]
  */
  
  -- Configurações JSONB (similar a coach_settings)
  group_settings JSONB DEFAULT '{}'::jsonb,
  
  -- Retenção de posts (dias)
  post_retention_days INTEGER DEFAULT 90 
    CHECK (post_retention_days BETWEEN 30 AND 365),
  
  -- Status
  archived BOOLEAN DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_study_groups_privacy ON study_groups(privacy_level, archived);
CREATE INDEX idx_study_groups_focus ON study_groups(focus_area) WHERE archived = false;
CREATE INDEX idx_study_groups_coach ON study_groups(coach_id) WHERE coach_id IS NOT NULL;
CREATE INDEX idx_study_groups_created ON study_groups(created_at DESC) WHERE archived = false;
CREATE INDEX idx_study_groups_posts_data ON study_groups USING GIN (posts_data);

-- ============================================
-- 2. TABELA: study_group_members (seguindo padrão user_followers)
-- ============================================
CREATE TABLE IF NOT EXISTS study_group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES study_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Role (adiciona ao padrão follower)
  role TEXT NOT NULL DEFAULT 'member' 
    CHECK (role IN ('member', 'moderator', 'admin', 'coach')),
  
  -- Status
  status TEXT NOT NULL DEFAULT 'active' 
    CHECK (status IN ('active', 'invited', 'pending', 'left')),
  
  -- Timestamp (similar a created_at do user_followers)
  joined_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(group_id, user_id)
);

-- Índices (seguindo padrão user_followers)
CREATE INDEX idx_group_members_group ON study_group_members(group_id);
CREATE INDEX idx_group_members_user ON study_group_members(user_id);
CREATE INDEX idx_group_members_status ON study_group_members(status);
CREATE INDEX idx_group_members_group_status ON study_group_members(group_id, status);

-- ============================================
-- 3. RLS (Row Level Security)
-- ============================================
ALTER TABLE study_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_group_members ENABLE ROW LEVEL SECURITY;

-- Políticas para study_groups
CREATE POLICY "Public groups are viewable by everyone"
  ON study_groups FOR SELECT
  USING (privacy_level = 'public' AND archived = false);

CREATE POLICY "Members can view private groups"
  ON study_groups FOR SELECT
  USING (
    privacy_level = 'public' OR
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM study_group_members
      WHERE group_id = study_groups.id
      AND user_id = auth.uid()
      AND status = 'active'
    )
  );

CREATE POLICY "Users can create groups"
  ON study_groups FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Admins can update groups"
  ON study_groups FOR UPDATE
  USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM study_group_members
      WHERE group_id = study_groups.id
      AND user_id = auth.uid()
      AND role IN ('admin', 'coach')
      AND status = 'active'
    )
  );

-- Políticas para study_group_members (seguindo padrão user_followers)
CREATE POLICY "Members can view group members"
  ON study_group_members FOR SELECT
  USING (
    -- Pode ver se é membro do grupo
    EXISTS (
      SELECT 1 FROM study_group_members sgm2
      WHERE sgm2.group_id = study_group_members.group_id
      AND sgm2.user_id = auth.uid()
      AND sgm2.status = 'active'
    )
    -- Ou se o grupo é público
    OR EXISTS (
      SELECT 1 FROM study_groups sg
      WHERE sg.id = study_group_members.group_id
      AND sg.privacy_level = 'public'
    )
  );

CREATE POLICY "Users can join groups" -- Similar a "Users can create own follower relationships"
  ON study_group_members FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can leave groups" -- Similar a "Users can delete own follower relationships"
  ON study_group_members FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage members"
  ON study_group_members FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM study_group_members sgm
      WHERE sgm.group_id = study_group_members.group_id
      AND sgm.user_id = auth.uid()
      AND sgm.role IN ('admin', 'moderator', 'coach')
      AND sgm.status = 'active'
    )
  );

-- ============================================
-- 4. FUNÇÕES RPC (seguindo padrão get_followers_list)
-- ============================================

-- Lista membros do grupo (similar a get_followers_list)
CREATE OR REPLACE FUNCTION public.get_group_members(p_group_id UUID)
RETURNS TABLE(id UUID, name TEXT, avatar_url TEXT, role TEXT, joined_at TIMESTAMP)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    up.id, 
    up.name, 
    up.avatar_url,
    sgm.role,
    sgm.joined_at
  FROM study_group_members sgm
  JOIN users_profiles up ON up.id = sgm.user_id
  WHERE sgm.group_id = p_group_id
    AND sgm.status = 'active'
  ORDER BY sgm.joined_at ASC;
$$;

-- Conta membros (similar a count_user_followers)
CREATE OR REPLACE FUNCTION public.count_group_members(p_group_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*) 
  FROM study_group_members 
  WHERE group_id = p_group_id 
    AND status = 'active';
$$;

-- Grupos do usuário (similar a get_following_list)
CREATE OR REPLACE FUNCTION public.get_user_groups(p_user_id UUID)
RETURNS TABLE(
  id UUID, 
  name TEXT, 
  description TEXT, 
  cover_image_url TEXT,
  role TEXT,
  members_count INTEGER,
  joined_at TIMESTAMP
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    sg.id,
    sg.name,
    sg.description,
    sg.cover_image_url,
    sgm.role,
    sg.current_members,
    sgm.joined_at
  FROM study_group_members sgm
  JOIN study_groups sg ON sg.id = sgm.group_id
  WHERE sgm.user_id = p_user_id
    AND sgm.status = 'active'
    AND sg.archived = false
  ORDER BY sgm.joined_at DESC;
$$;

-- Permissões
GRANT EXECUTE ON FUNCTION public.get_group_members(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.count_group_members(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_groups(UUID) TO anon, authenticated;

-- ============================================
-- 5. TRIGGERS para atualizar contadores
-- ============================================

-- Atualizar current_members quando membro é adicionado/removido
CREATE OR REPLACE FUNCTION update_group_members_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'active' THEN
    UPDATE study_groups
    SET current_members = current_members + 1,
        updated_at = NOW()
    WHERE id = NEW.group_id;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'active' AND NEW.status != 'active' THEN
      -- Membro saiu
      UPDATE study_groups
      SET current_members = GREATEST(current_members - 1, 0),
          updated_at = NOW()
      WHERE id = NEW.group_id;
    ELSIF OLD.status != 'active' AND NEW.status = 'active' THEN
      -- Membro voltou
      UPDATE study_groups
      SET current_members = current_members + 1,
          updated_at = NOW()
      WHERE id = NEW.group_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' AND OLD.status = 'active' THEN
    UPDATE study_groups
    SET current_members = GREATEST(current_members - 1, 0),
        updated_at = NOW()
    WHERE id = OLD.group_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_group_members_count
  AFTER INSERT OR UPDATE OR DELETE ON study_group_members
  FOR EACH ROW EXECUTE FUNCTION update_group_members_count();

-- ============================================
-- 6. FUNÇÕES para gerenciar posts JSONB
-- ============================================

-- Calcular expires_at baseado na configuração do grupo
CREATE OR REPLACE FUNCTION calculate_post_expires_at(p_group_id UUID)
RETURNS TIMESTAMP AS $$
DECLARE
  v_retention_days INTEGER;
BEGIN
  SELECT COALESCE(post_retention_days, 90) 
  INTO v_retention_days
  FROM study_groups 
  WHERE id = p_group_id;
  
  RETURN NOW() + (v_retention_days || ' days')::INTERVAL;
END;
$$ LANGUAGE plpgsql STABLE;

-- Adicionar post ao grupo
CREATE OR REPLACE FUNCTION add_group_post(
  p_group_id UUID,
  p_author_id UUID,
  p_content TEXT
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_new_post JSONB;
  v_expires_at TIMESTAMP;
BEGIN
  -- Calcular expires_at
  v_expires_at := calculate_post_expires_at(p_group_id);
  
  -- Criar novo post
  v_new_post := jsonb_build_object(
    'id', gen_random_uuid(),
    'author_id', p_author_id,
    'content', p_content,
    'comments_count', 0,
    'comments', '[]'::jsonb,
    'is_pinned', false,
    'is_deleted', false,
    'expires_at', v_expires_at,
    'created_at', NOW()
  );
  
  -- Adicionar ao início do array
  UPDATE study_groups
  SET 
    posts_data = jsonb_insert(
      COALESCE(posts_data, '[]'::jsonb),
      '{0}',
      v_new_post
    ),
    updated_at = NOW()
  WHERE id = p_group_id;
  
  RETURN jsonb_build_object('success', true, 'post', v_new_post);
END;
$$;

-- Adicionar comentário a um post
CREATE OR REPLACE FUNCTION add_post_comment(
  p_group_id UUID,
  p_post_id UUID,
  p_author_id UUID,
  p_content TEXT,
  p_parent_comment_id UUID DEFAULT NULL
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_new_comment JSONB;
  v_expires_at TIMESTAMP;
  v_post_idx INTEGER;
  v_posts JSONB;
BEGIN
  -- Calcular expires_at
  v_expires_at := calculate_post_expires_at(p_group_id);
  
  -- Criar comentário
  v_new_comment := jsonb_build_object(
    'id', gen_random_uuid(),
    'author_id', p_author_id,
    'content', p_content,
    'parent_comment_id', p_parent_comment_id,
    'created_at', NOW()
  );
  
  -- Buscar posts
  SELECT posts_data INTO v_posts
  FROM study_groups
  WHERE id = p_group_id;
  
  -- Encontrar índice do post
  SELECT idx INTO v_post_idx
  FROM (
    SELECT 
      row_number() OVER () - 1 as idx,
      (value->>'id')::text as post_id
    FROM jsonb_array_elements(v_posts)
  ) posts_with_idx
  WHERE post_id = p_post_id::text
  LIMIT 1;
  
  IF v_post_idx IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Post não encontrado');
  END IF;
  
  -- Adicionar comentário e atualizar contador
  UPDATE study_groups
  SET 
    posts_data = jsonb_set(
      posts_data,
      ARRAY[v_post_idx::text, 'comments'],
      COALESCE(posts_data->v_post_idx->'comments', '[]'::jsonb) || v_new_comment
    ),
    posts_data = jsonb_set(
      posts_data,
      ARRAY[v_post_idx::text, 'comments_count'],
      to_jsonb((COALESCE((posts_data->v_post_idx->>'comments_count')::integer, 0) + 1))
    ),
    updated_at = NOW()
  WHERE id = p_group_id;
  
  RETURN jsonb_build_object('success', true, 'comment', v_new_comment);
END;
$$;

-- Buscar feed do grupo
CREATE OR REPLACE FUNCTION get_group_feed(
  p_group_id UUID,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_posts JSONB;
BEGIN
  SELECT jsonb_agg(post ORDER BY 
    CASE WHEN (post->>'is_pinned')::boolean THEN 0 ELSE 1 END,
    (post->>'created_at')::timestamp DESC
  )
  INTO v_posts
  FROM (
    SELECT value as post
    FROM study_groups,
    jsonb_array_elements(posts_data) as value
    WHERE study_groups.id = p_group_id
      AND (value->>'is_deleted')::boolean = false
      AND (value->>'expires_at')::timestamp > NOW()
    ORDER BY 
      CASE WHEN (value->>'is_pinned')::boolean THEN 0 ELSE 1 END,
      (value->>'created_at')::timestamp DESC
    LIMIT p_limit
    OFFSET p_offset
  ) filtered_posts;
  
  RETURN COALESCE(v_posts, '[]'::jsonb);
END;
$$;

-- Limpar posts expirados (soft delete)
CREATE OR REPLACE FUNCTION cleanup_expired_posts(p_group_id UUID)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_posts_remaining INTEGER;
  v_updated_data JSONB;
BEGIN
  -- Atualizar removendo posts expirados ou deletados
  UPDATE study_groups
  SET 
    posts_data = (
      SELECT COALESCE(jsonb_agg(post), '[]'::jsonb)
      FROM jsonb_array_elements(posts_data) as post
      WHERE (post->>'expires_at')::timestamp > NOW()
        AND (post->>'is_deleted')::boolean = false
    ),
    updated_at = NOW()
  WHERE id = p_group_id
  RETURNING posts_data INTO v_updated_data;
  
  -- Contar posts restantes
  v_posts_remaining := jsonb_array_length(COALESCE(v_updated_data, '[]'::jsonb));
  
  RETURN jsonb_build_object(
    'success', true,
    'posts_remaining', v_posts_remaining
  );
END;
$$;

-- Permissões para funções de posts
GRANT EXECUTE ON FUNCTION public.add_group_post(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_post_comment(UUID, UUID, UUID, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_group_feed(UUID, INTEGER, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_posts(UUID) TO authenticated;

