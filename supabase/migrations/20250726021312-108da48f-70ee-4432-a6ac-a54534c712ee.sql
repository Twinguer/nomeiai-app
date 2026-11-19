-- Create study_contests table
CREATE TABLE public.study_contests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  exam_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on study_contests
ALTER TABLE public.study_contests ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for study_contests
CREATE POLICY "Usuários podem ver seus próprios concursos de estudo" ON public.study_contests
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem inserir seus próprios concursos de estudo" ON public.study_contests
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar seus próprios concursos de estudo" ON public.study_contests
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem deletar seus próprios concursos de estudo" ON public.study_contests
FOR DELETE USING (auth.uid() = user_id);

-- Add study_contest_id to study_subjects
ALTER TABLE public.study_subjects 
ADD COLUMN study_contest_id UUID REFERENCES public.study_contests(id);

-- Add block_name to study_subjects for organizing disciplines by blocks
ALTER TABLE public.study_subjects 
ADD COLUMN block_name TEXT,
ADD COLUMN is_completed BOOLEAN DEFAULT false,
ADD COLUMN estimated_hours NUMERIC DEFAULT 0,
ADD COLUMN completed_hours NUMERIC DEFAULT 0;

-- Add study_contest_id to study_sessions
ALTER TABLE public.study_sessions 
ADD COLUMN study_contest_id UUID REFERENCES public.study_contests(id);

-- Add study_contest_id to study_progress  
ALTER TABLE public.study_progress 
ADD COLUMN study_contest_id UUID REFERENCES public.study_contests(id);

-- Create trigger for updated_at on study_contests
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_study_contests_updated_at 
BEFORE UPDATE ON public.study_contests 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_study_contests_user_id ON public.study_contests(user_id);
CREATE INDEX idx_study_contests_exam_date ON public.study_contests(exam_date);
CREATE INDEX idx_study_subjects_study_contest_id ON public.study_subjects(study_contest_id);
CREATE INDEX idx_study_sessions_study_contest_id ON public.study_sessions(study_contest_id);
CREATE INDEX idx_study_progress_study_contest_id ON public.study_progress(study_contest_id);