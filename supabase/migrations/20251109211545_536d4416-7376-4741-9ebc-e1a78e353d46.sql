-- ============================================
-- MELHORIAS DE SEGURANÇA - PARTE 1
-- ============================================

-- FASE 1: MELHORAR SISTEMA DE VOUCHERS
-- Adicionar campos de segurança na tabela vouchers
ALTER TABLE vouchers 
ADD COLUMN IF NOT EXISTS max_uses_per_user INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS cooldown_hours INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS usage_limit_per_ip INTEGER DEFAULT 3,
ADD COLUMN IF NOT EXISTS valid_from TIMESTAMPTZ;

-- Renomear current_uses para uses_count se necessário
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vouchers' AND column_name = 'current_uses'
  ) THEN
    ALTER TABLE vouchers RENAME COLUMN current_uses TO uses_count;
  END IF;
END $$;

-- Adicionar IP tracking e user agent na tabela vouchers_applied
ALTER TABLE vouchers_applied 
ADD COLUMN IF NOT EXISTS ip_address TEXT,
ADD COLUMN IF NOT EXISTS user_agent TEXT;

-- FASE 2: TRIGGER PARA PERFIS AUTOMÁTICOS
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users_profiles (
    id, 
    email, 
    name, 
    nickname,
    created_at, 
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', 'Usuário'),
    NEW.raw_user_meta_data->>'nickname',
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Erro ao criar perfil para usuário %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE FUNCTION handle_new_user();

-- FASE 3: AUDIT LOG EXPANDIDO
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  metadata JSONB DEFAULT '{}'::JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own audit logs" ON audit_logs;
CREATE POLICY "Users can view own audit logs" ON audit_logs
  FOR SELECT
  USING (auth.uid() = user_id);

-- Função para registrar ações sensíveis
CREATE OR REPLACE FUNCTION log_sensitive_action(
  p_user_id UUID,
  p_action TEXT,
  p_resource_type TEXT,
  p_resource_id TEXT,
  p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS void AS $$
BEGIN
  INSERT INTO audit_logs (
    user_id, action, resource_type, resource_id, 
    metadata, created_at
  ) VALUES (
    p_user_id, p_action, p_resource_type, p_resource_id,
    p_metadata, NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Criar índices
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_vouchers_applied_ip ON vouchers_applied(ip_address);
CREATE INDEX IF NOT EXISTS idx_vouchers_applied_voucher_user ON vouchers_applied(voucher_id, user_id);