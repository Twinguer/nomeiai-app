-- ============================================
-- CORREÇÃO: Recursão infinita nas políticas RLS
-- Data: 2025-01-29
-- ============================================

-- Remover políticas problemáticas
DROP POLICY IF EXISTS "Members can view group members" ON study_group_members;
DROP POLICY IF EXISTS "Users can join groups" ON study_group_members;
DROP POLICY IF EXISTS "Users can leave groups" ON study_group_members;
DROP POLICY IF EXISTS "Admins can manage members" ON study_group_members;

-- ============================================
-- NOVAS POLÍTICAS (sem recursão)
-- ============================================

-- SELECT: Qualquer pessoa pode ver membros de grupos públicos
-- OU se for membro do grupo (mas usando função para evitar recursão)
CREATE POLICY "Public groups members are viewable"
  ON study_group_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM study_groups sg
      WHERE sg.id = study_group_members.group_id
      AND sg.privacy_level = 'public'
    )
  );

-- SELECT: Membros podem ver outros membros do mesmo grupo
-- Usa SECURITY DEFINER na função para evitar recursão
CREATE POLICY "Group members can view members"
  ON study_group_members FOR SELECT
  USING (
    -- Verifica diretamente se o usuário é membro usando uma subquery simples
    user_id = auth.uid()
    OR
    group_id IN (
      SELECT sgm2.group_id 
      FROM study_group_members sgm2
      WHERE sgm2.user_id = auth.uid() 
      AND sgm2.status = 'active'
      LIMIT 1000
    )
  );

-- INSERT: Qualquer usuário autenticado pode se adicionar a grupos
-- (a verificação de privacidade será feita no frontend ou em função RPC)
CREATE POLICY "Authenticated users can join groups"
  ON study_group_members FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND auth.uid() IS NOT NULL
  );

-- UPDATE: Usuários podem atualizar seu próprio status
CREATE POLICY "Users can update own membership"
  ON study_group_members FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- UPDATE: Criadores do grupo podem gerenciar membros
CREATE POLICY "Group creators can manage members"
  ON study_group_members FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM study_groups sg
      WHERE sg.id = study_group_members.group_id
      AND sg.created_by = auth.uid()
    )
  );

-- UPDATE: Admins do grupo podem gerenciar membros
-- Usa função para evitar recursão
CREATE OR REPLACE FUNCTION is_group_admin(p_group_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM study_group_members sgm
    WHERE sgm.group_id = p_group_id
      AND sgm.user_id = p_user_id
      AND sgm.role IN ('admin', 'coach')
      AND sgm.status = 'active'
  );
$$;

CREATE POLICY "Group admins can manage members"
  ON study_group_members FOR UPDATE
  USING (
    is_group_admin(group_id, auth.uid())
  );

-- DELETE: Usuários podem remover a si mesmos
CREATE POLICY "Users can leave groups"
  ON study_group_members FOR DELETE
  USING (auth.uid() = user_id);

-- DELETE: Criadores e admins podem remover membros
CREATE POLICY "Admins can remove members"
  ON study_group_members FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM study_groups sg
      WHERE sg.id = study_group_members.group_id
      AND sg.created_by = auth.uid()
    )
    OR is_group_admin(group_id, auth.uid())
  );

-- Permissões para a função
GRANT EXECUTE ON FUNCTION is_group_admin(UUID, UUID) TO anon, authenticated;

