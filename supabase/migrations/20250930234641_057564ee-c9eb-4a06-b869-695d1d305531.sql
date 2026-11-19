-- Create subscription plans enum
CREATE TYPE subscription_plan AS ENUM ('free', 'pro');

-- Create user subscriptions table
CREATE TABLE user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan subscription_plan NOT NULL DEFAULT 'free',
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  voucher_code TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Create vouchers table
CREATE TABLE vouchers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  plan subscription_plan NOT NULL,
  duration_months INTEGER NOT NULL DEFAULT 1,
  max_uses INTEGER NOT NULL DEFAULT 1,
  current_uses INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  description TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE vouchers ENABLE ROW LEVEL SECURITY;

-- Policies for user_subscriptions
CREATE POLICY "Users can view their own subscription"
ON user_subscriptions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own subscription"
ON user_subscriptions FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own subscription"
ON user_subscriptions FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all subscriptions"
ON user_subscriptions FOR SELECT
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage subscriptions"
ON user_subscriptions FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- Policies for vouchers
CREATE POLICY "Admins can manage vouchers"
ON vouchers FOR ALL
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view active vouchers"
ON vouchers FOR SELECT
USING (is_active = true AND auth.uid() IS NOT NULL);

-- Function to apply voucher
CREATE OR REPLACE FUNCTION apply_voucher(voucher_code_param TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_voucher RECORD;
  v_user_id UUID;
  v_new_expiry TIMESTAMP WITH TIME ZONE;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuário não autenticado');
  END IF;

  -- Get voucher
  SELECT * INTO v_voucher
  FROM vouchers
  WHERE code = voucher_code_param
    AND is_active = true
    AND current_uses < max_uses
    AND (expires_at IS NULL OR expires_at > NOW());
  
  IF v_voucher IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Voucher inválido ou expirado');
  END IF;

  -- Calculate new expiry
  v_new_expiry := NOW() + (v_voucher.duration_months || ' months')::INTERVAL;

  -- Update or insert subscription
  INSERT INTO user_subscriptions (user_id, plan, expires_at, voucher_code)
  VALUES (v_user_id, v_voucher.plan, v_new_expiry, voucher_code_param)
  ON CONFLICT (user_id) 
  DO UPDATE SET
    plan = v_voucher.plan,
    expires_at = v_new_expiry,
    voucher_code = voucher_code_param,
    is_active = true,
    updated_at = NOW();

  -- Increment voucher usage
  UPDATE vouchers
  SET current_uses = current_uses + 1,
      updated_at = NOW()
  WHERE code = voucher_code_param;

  RETURN jsonb_build_object(
    'success', true, 
    'plan', v_voucher.plan,
    'expires_at', v_new_expiry
  );
END;
$$;

-- Insert default subscriptions for specific users (Moderecocopa and Pati)
-- This will be executed after the migration to set existing users as free
INSERT INTO user_subscriptions (user_id, plan, is_active)
SELECT id, 'free'::subscription_plan, true
FROM auth.users
WHERE email IN (
  SELECT email FROM users_profiles WHERE name IN ('Moderecocopa', 'Pati')
)
ON CONFLICT (user_id) DO NOTHING;