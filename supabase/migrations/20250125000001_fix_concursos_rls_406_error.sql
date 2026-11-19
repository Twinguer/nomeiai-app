-- ============================================================================
-- CORREÇÃO DO ERRO 406: Habilitar RLS na tabela concursos
-- ============================================================================
-- Este migration corrige o erro 406 (Not Acceptable) que ocorre ao tentar
-- fazer queries na tabela concursos sem políticas RLS adequadas.

-- 1. Habilitar RLS na tabela concursos (se não estiver habilitado)
ALTER TABLE public.concursos ENABLE ROW LEVEL SECURITY;

-- 2. Remover políticas existentes (se houver) para evitar conflitos
DROP POLICY IF EXISTS "Public can read concursos" ON public.concursos;
DROP POLICY IF EXISTS "Users can read concursos" ON public.concursos;
DROP POLICY IF EXISTS "Authenticated users can read concursos" ON public.concursos;

-- 3. Criar política que permite leitura pública de concursos
-- Isso é necessário para que as queries de exam_type funcionem corretamente
CREATE POLICY "Public can read concursos"
  ON public.concursos FOR SELECT
  USING (true);

-- 4. Criar política para inserção (apenas usuários autenticados)
CREATE POLICY "Authenticated users can insert concursos"
  ON public.concursos FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- 5. Criar política para atualização (apenas criador ou admin)
CREATE POLICY "Users can update their own concursos"
  ON public.concursos FOR UPDATE
  USING (
    auth.uid() = created_by 
    OR has_role(auth.uid(), 'admin'::app_role)
  )
  WITH CHECK (
    auth.uid() = created_by 
    OR has_role(auth.uid(), 'admin'::app_role)
  );

-- 6. Criar política para exclusão (apenas criador ou admin)
CREATE POLICY "Users can delete their own concursos"
  ON public.concursos FOR DELETE
  USING (
    auth.uid() = created_by 
    OR has_role(auth.uid(), 'admin'::app_role)
  );

-- 7. Adicionar comentários explicativos
COMMENT ON POLICY "Public can read concursos" ON public.concursos IS 
'Permite leitura pública de concursos para listas de classificação, perfis públicos e consultas de exam_type. Necessário para corrigir erro 406.';

COMMENT ON POLICY "Authenticated users can insert concursos" ON public.concursos IS 
'Permite que usuários autenticados criem novos concursos.';

COMMENT ON POLICY "Users can update their own concursos" ON public.concursos IS 
'Permite que usuários atualizem apenas os concursos que criaram, ou admins atualizem qualquer concurso.';

COMMENT ON POLICY "Users can delete their own concursos" ON public.concursos IS 
'Permite que usuários excluam apenas os concursos que criaram, ou admins excluam qualquer concurso.';

-- 8. Verificar se a tabela tem a coluna created_by (necessária para as políticas)
-- Se não existir, criar com valor padrão
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'concursos' 
    AND column_name = 'created_by'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.concursos ADD COLUMN created_by UUID REFERENCES auth.users(id);
    -- Atualizar registros existentes com um usuário padrão (se necessário)
    -- UPDATE public.concursos SET created_by = (SELECT id FROM auth.users LIMIT 1) WHERE created_by IS NULL;
  END IF;
END $$;
