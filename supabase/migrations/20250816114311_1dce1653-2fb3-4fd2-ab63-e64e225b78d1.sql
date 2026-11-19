-- CRITICAL SECURITY FIXES - Phase 2 (Fixed)

-- 1. Secure consolidated_answers_by_concurso table
DROP POLICY IF EXISTS "Todos podem ler dados consolidados" ON consolidated_answers_by_concurso;
DROP POLICY IF EXISTS "Sistema pode inserir dados consolidados" ON consolidated_answers_by_concurso;
DROP POLICY IF EXISTS "Sistema pode atualizar dados consolidados" ON consolidated_answers_by_concurso;

-- Only allow users to see consolidated data for concursos they participate in
CREATE POLICY "Users can only see consolidated data for their concursos"
ON consolidated_answers_by_concurso
FOR SELECT
TO authenticated
USING (
  concurso_id IN (
    SELECT concurso_id 
    FROM user_rankings 
    WHERE user_id = auth.uid()
  )
);

-- Only allow system functions to insert/update consolidated data
CREATE POLICY "Only system functions can insert consolidated data"
ON consolidated_answers_by_concurso
FOR INSERT
TO authenticated
WITH CHECK (false); -- Block all direct inserts

CREATE POLICY "Only system functions can update consolidated data"
ON consolidated_answers_by_concurso
FOR UPDATE
TO authenticated
USING (false); -- Block all direct updates

-- 2. Secure score_calculation_logs table
DROP POLICY IF EXISTS "score_calculation_logs_select_all" ON score_calculation_logs;
DROP POLICY IF EXISTS "score_calculation_logs_insert_all" ON score_calculation_logs;

-- Only allow users to see their own score calculation logs
CREATE POLICY "Users can only see their own score logs"
ON score_calculation_logs
FOR SELECT
TO authenticated
USING (
  user_ranking_id IN (
    SELECT id 
    FROM user_rankings 
    WHERE user_id = auth.uid()
  )
);

-- Only allow system functions to insert logs
CREATE POLICY "Only functions can insert score logs"
ON score_calculation_logs
FOR INSERT
TO authenticated
WITH CHECK (false); -- Will be bypassed by SECURITY DEFINER functions

-- 3. Secure user_answers table better
DROP POLICY IF EXISTS "user_answers_select_all" ON user_answers;
DROP POLICY IF EXISTS "Funções de sistema podem acessar todas respostas" ON user_answers;

-- Replace overly permissive policies
CREATE POLICY "Users can only see own answers and admins can see all"
ON user_answers
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM user_rankings ur 
    WHERE ur.id = user_answers.user_ranking_id 
    AND ur.user_id = auth.uid()
  ) 
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- 4. Secure user_rankings table better
DROP POLICY IF EXISTS "user_rankings_select_all" ON user_rankings;
DROP POLICY IF EXISTS "user_rankings_update_all" ON user_rankings;
DROP POLICY IF EXISTS "Allow service_role to update all rankings" ON user_rankings;

-- Replace overly permissive policies with secure ones
CREATE POLICY "Public can read basic ranking info"
ON user_rankings
FOR SELECT
TO authenticated
USING (true); -- This is OK for leaderboards

CREATE POLICY "Users can only update their own rankings"
ON user_rankings
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- 5. Enable RLS on users_profiles table if not already enabled
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE tablename = 'users_profiles' 
    AND rowsecurity = true
  ) THEN
    ALTER TABLE users_profiles ENABLE ROW LEVEL SECURITY;
  END IF;
END
$$;

-- Drop any overly permissive policies first
DROP POLICY IF EXISTS "Enable read access for all users" ON users_profiles;
DROP POLICY IF EXISTS "Enable insert for all authenticated users" ON users_profiles;
DROP POLICY IF EXISTS "Enable update for all authenticated users" ON users_profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON users_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON users_profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON users_profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON users_profiles;

-- Add proper RLS policies for users_profiles
CREATE POLICY "Public profiles are viewable by everyone"
ON users_profiles
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can insert their own profile"
ON users_profiles
FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid());

CREATE POLICY "Users can update their own profile"
ON users_profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

CREATE POLICY "Admins can delete profiles"
ON users_profiles
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));