-- Create table for tracking user study days
CREATE TABLE public.user_study_days (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  study_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, study_date)
);

-- Enable Row Level Security
ALTER TABLE public.user_study_days ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own study days" 
ON public.user_study_days 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own study days" 
ON public.user_study_days 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own study days" 
ON public.user_study_days 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own study days" 
ON public.user_study_days 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create index for better performance
CREATE INDEX idx_user_study_days_user_id ON public.user_study_days(user_id);
CREATE INDEX idx_user_study_days_date ON public.user_study_days(study_date);