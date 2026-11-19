-- Ensure RLS is enabled on concursos
ALTER TABLE public.concursos ENABLE ROW LEVEL SECURITY;

-- Create UPDATE policies safely if they don't exist
DO $$
BEGIN
  -- Owner can update their own concursos
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'concursos' AND policyname = 'Users can update their own concursos'
  ) THEN
    CREATE POLICY "Users can update their own concursos"
    ON public.concursos
    FOR UPDATE
    USING (auth.uid() = created_by_user_id)
    WITH CHECK (auth.uid() = created_by_user_id);
  END IF;

  -- Admins can update all concursos
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'concursos' AND policyname = 'Admins can update all concursos'
  ) THEN
    CREATE POLICY "Admins can update all concursos"
    ON public.concursos
    FOR UPDATE
    USING (has_role(auth.uid(), 'admin'::app_role))
    WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
  END IF;
END $$;