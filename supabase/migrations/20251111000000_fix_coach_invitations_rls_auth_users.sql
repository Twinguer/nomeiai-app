-- Migration: Fix coach_invitations_history RLS policy to avoid direct auth.users access
-- This fixes the error "permission denied for table users"
-- Date: 2025-11-11

-- Criar função helper para obter email do usuário atual (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.get_current_user_email()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
DECLARE
  v_email TEXT;
BEGIN
  SELECT email INTO v_email
  FROM auth.users
  WHERE id = auth.uid();
  
  RETURN v_email;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.get_current_user_email IS 
  'Retorna o email do usuário autenticado atual. Usa SECURITY DEFINER para acessar auth.users.';

-- Remover política antiga que acessa auth.users diretamente
DROP POLICY IF EXISTS "Students can view invitations for them" ON coach_invitations_history;

-- Criar nova política usando a função helper
CREATE POLICY "Students can view invitations for them"
  ON coach_invitations_history FOR SELECT
  USING (
    auth.uid() = student_id 
    OR student_email = public.get_current_user_email()
  );

-- Atualizar também a política de UPDATE que tem o mesmo problema
DROP POLICY IF EXISTS "Students can update invitations for them" ON coach_invitations_history;

CREATE POLICY "Students can update invitations for them"
  ON coach_invitations_history FOR UPDATE
  USING (
    auth.uid() = student_id 
    OR student_email = public.get_current_user_email()
  )
  WITH CHECK (
    auth.uid() = student_id 
    OR student_email = public.get_current_user_email()
  );

-- Comentários
COMMENT ON POLICY "Students can view invitations for them" ON coach_invitations_history IS 
  'Permite que alunos vejam convites destinados a eles, usando função helper para acessar email de forma segura';
COMMENT ON POLICY "Students can update invitations for them" ON coach_invitations_history IS 
  'Permite que alunos atualizem status de convites destinados a eles, usando função helper para acessar email de forma segura';

