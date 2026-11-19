-- ============================================
-- Migration: Payment Preferences Table
-- Descrição: Tabela para rastrear preferências e pagamentos do Mercado Pago
-- Segurança: RLS habilitado com políticas específicas
-- ============================================

-- Criar tabela payment_preferences
CREATE TABLE IF NOT EXISTS payment_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL CHECK (plan_id IN ('pro', 'trimestral', 'semestral', 'anual')),
  preference_id TEXT NOT NULL UNIQUE,
  external_reference TEXT NOT NULL UNIQUE,
  payment_id TEXT,
  amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled', 'refunded')),
  mercado_pago_payment_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  -- Constraints adicionais
  CONSTRAINT valid_preference CHECK (preference_id IS NOT NULL AND preference_id != ''),
  CONSTRAINT valid_external_reference CHECK (external_reference IS NOT NULL AND external_reference != '')
);

-- Índices para performance e queries otimizadas
CREATE INDEX IF NOT EXISTS idx_payment_preferences_user_id ON payment_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_preferences_external_reference ON payment_preferences(external_reference);
CREATE INDEX IF NOT EXISTS idx_payment_preferences_status ON payment_preferences(status);
CREATE INDEX IF NOT EXISTS idx_payment_preferences_preference_id ON payment_preferences(preference_id);
CREATE INDEX IF NOT EXISTS idx_payment_preferences_payment_id ON payment_preferences(payment_id) WHERE payment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payment_preferences_created_at ON payment_preferences(created_at DESC);

-- Índice composto para queries comuns
CREATE INDEX IF NOT EXISTS idx_payment_preferences_user_status ON payment_preferences(user_id, status);

-- Habilitar RLS
ALTER TABLE payment_preferences ENABLE ROW LEVEL SECURITY;

-- Política: Usuários podem visualizar suas próprias preferências
CREATE POLICY "users_view_own_payment_preferences"
ON payment_preferences FOR SELECT
USING (auth.uid() = user_id);

-- Política: Usuários podem inserir suas próprias preferências
CREATE POLICY "users_insert_own_payment_preferences"
ON payment_preferences FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Política: Usuários podem atualizar suas próprias preferências (apenas quando pendente)
CREATE POLICY "users_update_own_pending_preferences"
ON payment_preferences FOR UPDATE
USING (auth.uid() = user_id AND status = 'pending')
WITH CHECK (auth.uid() = user_id);

-- Política: Service role tem acesso completo (para webhooks e operações administrativas)
CREATE POLICY "service_role_full_access"
ON payment_preferences FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role')
WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- Política: Admins podem visualizar todas as preferências
CREATE POLICY "admins_view_all_payment_preferences"
ON payment_preferences FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
);

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_payment_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para atualizar updated_at
DROP TRIGGER IF EXISTS trigger_update_payment_preferences_updated_at ON payment_preferences;
CREATE TRIGGER trigger_update_payment_preferences_updated_at
  BEFORE UPDATE ON payment_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_payment_preferences_updated_at();

-- Comentários para documentação
COMMENT ON TABLE payment_preferences IS 'Armazena preferências de pagamento e status do Mercado Pago';
COMMENT ON COLUMN payment_preferences.preference_id IS 'ID da preferência retornado pelo Mercado Pago';
COMMENT ON COLUMN payment_preferences.external_reference IS 'Referência externa usada para rastrear pagamentos (formato: user_id_planId_timestamp)';
COMMENT ON COLUMN payment_preferences.mercado_pago_payment_data IS 'Dados completos do pagamento retornados pelo Mercado Pago (JSON)';
COMMENT ON COLUMN payment_preferences.status IS 'Status do pagamento: pending, approved, rejected, cancelled, refunded';


