-- Criar tabela para armazenar preferências de pagamento do Mercado Pago
CREATE TABLE IF NOT EXISTS public.payment_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL,
  preference_id TEXT NOT NULL UNIQUE,
  external_reference TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_payment_preferences_user_id ON public.payment_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_preferences_preference_id ON public.payment_preferences(preference_id);
CREATE INDEX IF NOT EXISTS idx_payment_preferences_status ON public.payment_preferences(status);

-- Habilitar RLS
ALTER TABLE public.payment_preferences ENABLE ROW LEVEL SECURITY;

-- Políticas RLS: Usuários podem ver apenas suas próprias preferências
CREATE POLICY "Users can view own payment preferences" 
ON public.payment_preferences 
FOR SELECT 
USING (auth.uid() = user_id);

-- Política para inserção (será feita pela edge function com service role)
CREATE POLICY "Service role can insert payment preferences" 
ON public.payment_preferences 
FOR INSERT 
WITH CHECK (true);

-- Política para atualização (será feita pela edge function com service role ou webhook)
CREATE POLICY "Service role can update payment preferences" 
ON public.payment_preferences 
FOR UPDATE 
USING (true);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_payment_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_payment_preferences_updated_at
BEFORE UPDATE ON public.payment_preferences
FOR EACH ROW
EXECUTE FUNCTION update_payment_preferences_updated_at();