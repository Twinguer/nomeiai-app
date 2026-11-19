-- Criar tabela para ciclos de estudos otimizada com JSON
CREATE TABLE public.study_cycles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  organ TEXT NOT NULL,
  position TEXT NOT NULL,
  exam_date DATE NOT NULL,
  blocks JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.study_cycles ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Usuários podem ver seus próprios ciclos" ON public.study_cycles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem inserir seus próprios ciclos" ON public.study_cycles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar seus próprios ciclos" ON public.study_cycles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem deletar seus próprios ciclos" ON public.study_cycles
  FOR DELETE USING (auth.uid() = user_id);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION public.update_study_cycles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_study_cycles_updated_at
  BEFORE UPDATE ON public.study_cycles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_study_cycles_updated_at();

-- Índices para performance
CREATE INDEX idx_study_cycles_user_id ON public.study_cycles(user_id);
CREATE INDEX idx_study_cycles_exam_date ON public.study_cycles(exam_date);
CREATE INDEX idx_study_cycles_active ON public.study_cycles(is_active) WHERE is_active = true;