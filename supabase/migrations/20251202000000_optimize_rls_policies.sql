-- ============================================
-- OTIMIZAÇÃO DE POLÍTICAS RLS
-- Substituir auth.uid() por (SELECT auth.uid()) para melhor performance
-- Data: 2025-12-02
-- ============================================

-- Função auxiliar para obter o user_id atual (otimizada)
-- Esta função será usada nas políticas para evitar reavaliação
CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid();
$$;

COMMENT ON FUNCTION public.current_user_id() IS 
'Retorna o ID do usuário autenticado atual. Função STABLE para otimização de políticas RLS.';

-- ============================================
-- STUDY_GROUP_MEMBERS
-- ============================================

-- Política: Active members can view members
DROP POLICY IF EXISTS "Active members can view members" ON public.study_group_members;
CREATE POLICY "Active members can view members"
  ON public.study_group_members FOR SELECT
  USING (
    (user_id = (SELECT auth.uid())) OR 
    (EXISTS (
      SELECT 1
      FROM (study_group_members sgm2
        JOIN study_groups sg ON (sg.id = sgm2.group_id))
      WHERE (sgm2.group_id = study_group_members.group_id) 
        AND (sgm2.user_id = (SELECT auth.uid())) 
        AND (sgm2.status = 'active') 
        AND ((sg.privacy_level = 'public') OR (sgm2.user_id = (SELECT auth.uid())))
    ))
  );

-- Política: Users can accept invites
DROP POLICY IF EXISTS "Users can accept invites" ON public.study_group_members;
CREATE POLICY "Users can accept invites"
  ON public.study_group_members FOR UPDATE
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK (
    (status = 'active') AND ((SELECT auth.uid()) = user_id)
  );

-- Política: Users can leave groups
DROP POLICY IF EXISTS "Users can leave groups" ON public.study_group_members;
CREATE POLICY "Users can leave groups"
  ON public.study_group_members FOR DELETE
  USING ((SELECT auth.uid()) = user_id);

-- Política: Users can request to join
DROP POLICY IF EXISTS "Users can request to join" ON public.study_group_members;
CREATE POLICY "Users can request to join"
  ON public.study_group_members FOR INSERT
  WITH CHECK (
    ((SELECT auth.uid()) = user_id) 
    AND ((SELECT auth.uid()) IS NOT NULL) 
    AND (status = 'requested')
  );

-- Política: Users can update own membership
DROP POLICY IF EXISTS "Users can update own membership" ON public.study_group_members;
CREATE POLICY "Users can update own membership"
  ON public.study_group_members FOR UPDATE
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- Política: only_pro_can_view_group_members
DROP POLICY IF EXISTS "only_pro_can_view_group_members" ON public.study_group_members;
CREATE POLICY "only_pro_can_view_group_members"
  ON public.study_group_members FOR SELECT
  USING (
    is_user_pro((SELECT auth.uid())) OR 
    has_role((SELECT auth.uid()), 'admin'::app_role)
  );

-- Política: only_pro_users_can_join_groups
DROP POLICY IF EXISTS "only_pro_users_can_join_groups" ON public.study_group_members;
CREATE POLICY "only_pro_users_can_join_groups"
  ON public.study_group_members FOR INSERT
  WITH CHECK (
    ((SELECT auth.uid()) = user_id) AND 
    (is_user_pro((SELECT auth.uid())) OR has_role((SELECT auth.uid()), 'admin'::app_role))
  );

-- Política: Group members can view members
DROP POLICY IF EXISTS "Group members can view members" ON public.study_group_members;
CREATE POLICY "Group members can view members"
  ON public.study_group_members FOR SELECT
  USING (
    (user_id = (SELECT auth.uid())) OR 
    (group_id IN (
      SELECT sgm2.group_id
      FROM study_group_members sgm2
      WHERE (sgm2.user_id = (SELECT auth.uid())) 
        AND (sgm2.status = 'active')
      LIMIT 1000
    ))
  );

-- Políticas de admin (otimizadas)
DROP POLICY IF EXISTS "Admins can accept requests" ON public.study_group_members;
CREATE POLICY "Admins can accept requests"
  ON public.study_group_members FOR UPDATE
  USING (
    (EXISTS (
      SELECT 1
      FROM study_groups sg
      WHERE (sg.id = study_group_members.group_id) 
        AND (sg.created_by = (SELECT auth.uid()))
    )) OR 
    is_group_admin(group_id, (SELECT auth.uid()))
  )
  WITH CHECK (
    (status = 'active') AND 
    (user_id = (SELECT study_group_members_1.user_id
      FROM study_group_members study_group_members_1
      WHERE (study_group_members_1.id = study_group_members_1.id)))
  );

DROP POLICY IF EXISTS "Admins can invite users" ON public.study_group_members;
CREATE POLICY "Admins can invite users"
  ON public.study_group_members FOR INSERT
  WITH CHECK (
    (EXISTS (
      SELECT 1
      FROM study_groups sg
      WHERE (sg.id = study_group_members.group_id) 
        AND ((sg.created_by = (SELECT auth.uid())) OR is_group_admin(study_group_members.group_id, (SELECT auth.uid())))
    )) AND 
    (status = ANY (ARRAY['invited'::text, 'active'::text]))
  );

DROP POLICY IF EXISTS "Admins can reject requests" ON public.study_group_members;
CREATE POLICY "Admins can reject requests"
  ON public.study_group_members FOR UPDATE
  USING (
    (EXISTS (
      SELECT 1
      FROM study_groups sg
      WHERE (sg.id = study_group_members.group_id) 
        AND (sg.created_by = (SELECT auth.uid()))
    )) OR 
    is_group_admin(group_id, (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "Admins can remove members" ON public.study_group_members;
CREATE POLICY "Admins can remove members"
  ON public.study_group_members FOR UPDATE
  USING (
    (EXISTS (
      SELECT 1
      FROM study_groups sg
      WHERE (sg.id = study_group_members.group_id) 
        AND (sg.created_by = (SELECT auth.uid()))
    )) OR 
    (EXISTS (
      SELECT 1
      FROM study_group_members sgm2
      WHERE (sgm2.group_id = study_group_members.group_id) 
        AND (sgm2.user_id = (SELECT auth.uid())) 
        AND (sgm2.role = ANY (ARRAY['admin'::text, 'coach'::text])) 
        AND (sgm2.status = 'active')
    ))
  );

DROP POLICY IF EXISTS "Creators can view all members" ON public.study_group_members;
CREATE POLICY "Creators can view all members"
  ON public.study_group_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM study_groups sg
      WHERE (sg.id = study_group_members.group_id) 
        AND (sg.created_by = (SELECT auth.uid()))
    )
  );

DROP POLICY IF EXISTS "Group admins can manage members" ON public.study_group_members;
CREATE POLICY "Group admins can manage members"
  ON public.study_group_members FOR UPDATE
  USING (is_group_admin(group_id, (SELECT auth.uid())));

DROP POLICY IF EXISTS "Group creators can manage members" ON public.study_group_members;
CREATE POLICY "Group creators can manage members"
  ON public.study_group_members FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM study_groups sg
      WHERE (sg.id = study_group_members.group_id) 
        AND (sg.created_by = (SELECT auth.uid()))
    )
  );

-- Políticas públicas (otimizadas)
DROP POLICY IF EXISTS "Public groups members are viewable" ON public.study_group_members;
CREATE POLICY "Public groups members are viewable"
  ON public.study_group_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM study_groups sg
      WHERE (sg.id = study_group_members.group_id) 
        AND (sg.privacy_level = 'public')
    )
  );

DROP POLICY IF EXISTS "Public groups members visible" ON public.study_group_members;
CREATE POLICY "Public groups members visible"
  ON public.study_group_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM study_groups sg
      WHERE (sg.id = study_group_members.group_id) 
        AND (sg.privacy_level = 'public') 
        AND (sg.archived = false)
    )
  );

-- ============================================
-- USER_RANKINGS
-- ============================================

DROP POLICY IF EXISTS "Users can update own rankings" ON public.user_rankings;
CREATE POLICY "Users can update own rankings"
  ON public.user_rankings FOR UPDATE
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "users_can_view_own_rankings_for_rpc" ON public.user_rankings;
CREATE POLICY "users_can_view_own_rankings_for_rpc"
  ON public.user_rankings FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "users_delete_own_rankings" ON public.user_rankings;
CREATE POLICY "users_delete_own_rankings"
  ON public.user_rankings FOR DELETE
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "users_insert_own_rankings_with_rate_limit" ON public.user_rankings;
CREATE POLICY "users_insert_own_rankings_with_rate_limit"
  ON public.user_rankings FOR INSERT
  WITH CHECK (
    ((SELECT auth.uid()) = user_id) AND 
    ((NOT (EXISTS (
      SELECT 1
      FROM pg_proc
      WHERE (pg_proc.proname = 'check_rate_limit'::name)
    ))) OR 
    ((check_rate_limit((SELECT auth.uid()), 'insert_user_rankings'::text, 50, 60) ->> 'allowed'::text) = 'true'::text))
  );

DROP POLICY IF EXISTS "users_update_own_rankings_with_rate_limit" ON public.user_rankings;
CREATE POLICY "users_update_own_rankings_with_rate_limit"
  ON public.user_rankings FOR UPDATE
  USING (
    ((SELECT auth.uid()) = user_id) AND 
    ((NOT (EXISTS (
      SELECT 1
      FROM pg_proc
      WHERE (pg_proc.proname = 'check_rate_limit'::name)
    ))) OR 
    ((check_rate_limit((SELECT auth.uid()), 'update_user_rankings'::text, 100, 60) ->> 'allowed'::text) = 'true'::text))
  )
  WITH CHECK (
    ((SELECT auth.uid()) = user_id) AND 
    ((NOT (EXISTS (
      SELECT 1
      FROM pg_proc
      WHERE (pg_proc.proname = 'check_rate_limit'::name)
    ))) OR 
    ((check_rate_limit((SELECT auth.uid()), 'update_user_rankings'::text, 100, 60) ->> 'allowed'::text) = 'true'::text))
  );

DROP POLICY IF EXISTS "Admins can delete user_rankings" ON public.user_rankings;
CREATE POLICY "Admins can delete user_rankings"
  ON public.user_rankings FOR DELETE
  USING (has_role((SELECT auth.uid()), 'admin'::app_role));

-- ============================================
-- USER_STUDY_V2
-- ============================================

DROP POLICY IF EXISTS "Users can access their own study data" ON public.user_study_v2;
CREATE POLICY "Users can access their own study data"
  ON public.user_study_v2 FOR ALL
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own study data" ON public.user_study_v2;
CREATE POLICY "Users can delete their own study data"
  ON public.user_study_v2 FOR DELETE
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own study data" ON public.user_study_v2;
CREATE POLICY "Users can insert their own study data"
  ON public.user_study_v2 FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own study sessions" ON public.user_study_v2;
CREATE POLICY "Users can insert their own study sessions"
  ON public.user_study_v2 FOR INSERT
  WITH CHECK (
    ((SELECT auth.uid()) = user_id) AND 
    ((check_rate_limit((SELECT auth.uid()), 'insert_user_study'::text, 200, 60) ->> 'allowed'::text) = 'true'::text)
  );

DROP POLICY IF EXISTS "Users can update their own study data" ON public.user_study_v2;
CREATE POLICY "Users can update their own study data"
  ON public.user_study_v2 FOR UPDATE
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own study sessions" ON public.user_study_v2;
CREATE POLICY "Users can update their own study sessions"
  ON public.user_study_v2 FOR UPDATE
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Coaches can view their students study data" ON public.user_study_v2;
CREATE POLICY "Coaches can view their students study data"
  ON public.user_study_v2 FOR SELECT
  USING (
    ((SELECT auth.uid()) = user_id) OR 
    (EXISTS (
      SELECT 1
      FROM coach_profiles cp
      WHERE (cp.coach_id = (SELECT auth.uid())) AND 
      ((SELECT count(*) AS count
        FROM jsonb_array_elements(cp.student_relationships) jsonb_array_elements(value)
        WHERE ((((jsonb_array_elements.value ->> 'student_id'::text))::uuid = user_study_v2.user_id) 
          AND ((jsonb_array_elements.value ->> 'status'::text) = 'active'::text))) > 0)
    ))
  );

DROP POLICY IF EXISTS "Coaches can update their students study data" ON public.user_study_v2;
CREATE POLICY "Coaches can update their students study data"
  ON public.user_study_v2 FOR UPDATE
  USING (
    ((SELECT auth.uid()) = user_id) OR 
    (EXISTS (
      SELECT 1
      FROM coach_profiles cp
      WHERE (cp.coach_id = (SELECT auth.uid())) AND 
      ((SELECT count(*) AS count
        FROM jsonb_array_elements(cp.student_relationships) jsonb_array_elements(value)
        WHERE ((((jsonb_array_elements.value ->> 'student_id'::text))::uuid = user_study_v2.user_id) 
          AND ((jsonb_array_elements.value ->> 'status'::text) = 'active'::text))) > 0)
    ))
  )
  WITH CHECK (
    ((SELECT auth.uid()) = user_id) OR 
    (EXISTS (
      SELECT 1
      FROM coach_profiles cp
      WHERE (cp.coach_id = (SELECT auth.uid())) AND 
      ((SELECT count(*) AS count
        FROM jsonb_array_elements(cp.student_relationships) jsonb_array_elements(value)
        WHERE ((((jsonb_array_elements.value ->> 'student_id'::text))::uuid = user_study_v2.user_id) 
          AND ((jsonb_array_elements.value ->> 'status'::text) = 'active'::text))) > 0)
    ))
  );

-- ============================================
-- USERS_PROFILES
-- ============================================

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.users_profiles;
CREATE POLICY "Users can insert their own profile"
  ON public.users_profiles FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.users_profiles;
CREATE POLICY "Users can update their own profile"
  ON public.users_profiles FOR UPDATE
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

DROP POLICY IF EXISTS "Admins can delete profiles" ON public.users_profiles;
CREATE POLICY "Admins can delete profiles"
  ON public.users_profiles FOR DELETE
  USING (has_role((SELECT auth.uid()), 'admin'::app_role));

DROP POLICY IF EXISTS "secure_users_can_insert_own_profile" ON public.users_profiles;
CREATE POLICY "secure_users_can_insert_own_profile"
  ON public.users_profiles FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = id);

DROP POLICY IF EXISTS "secure_users_can_update_own_profile" ON public.users_profiles;
CREATE POLICY "secure_users_can_update_own_profile"
  ON public.users_profiles FOR UPDATE
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

DROP POLICY IF EXISTS "secure_admins_can_view_all_profiles" ON public.users_profiles;
CREATE POLICY "secure_admins_can_view_all_profiles"
  ON public.users_profiles FOR SELECT
  USING (has_role((SELECT auth.uid()), 'admin'::app_role));

