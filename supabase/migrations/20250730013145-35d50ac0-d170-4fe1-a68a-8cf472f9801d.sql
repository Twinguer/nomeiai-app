-- Criar tabela para estatísticas de estudo em formato JSON otimizado
CREATE TABLE public.study_statistics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  statistics_data JSONB NOT NULL DEFAULT '{
    "totalHours": 0,
    "totalSessions": 0,
    "questionsAnswered": 0,
    "correctAnswers": 0,
    "wrongAnswers": 0,
    "currentStreak": 0,
    "longestStreak": 0,
    "lastStudyDate": null,
    "dailyStats": {},
    "weeklyStats": {},
    "monthlyStats": {},
    "averages": {
      "dailyHours": 0,
      "weeklyHours": 0,
      "monthlyHours": 0
    },
    "sessionHistory": [],
    "lastUpdated": null
  }'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.study_statistics ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Usuários podem ver suas próprias estatísticas"
ON public.study_statistics
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem inserir suas próprias estatísticas"
ON public.study_statistics
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar suas próprias estatísticas"
ON public.study_statistics
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem deletar suas próprias estatísticas"
ON public.study_statistics
FOR DELETE
USING (auth.uid() = user_id);

-- Índices para performance
CREATE INDEX idx_study_statistics_user_id ON public.study_statistics(user_id);
CREATE INDEX idx_study_statistics_statistics_data ON public.study_statistics USING GIN(statistics_data);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_study_statistics_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  NEW.statistics_data = jsonb_set(NEW.statistics_data, '{lastUpdated}', to_jsonb(now()));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_study_statistics_updated_at
BEFORE UPDATE ON public.study_statistics
FOR EACH ROW
EXECUTE FUNCTION public.update_study_statistics_updated_at();