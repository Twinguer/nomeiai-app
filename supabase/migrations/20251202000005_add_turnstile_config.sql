-- ============================================
-- CONFIGURAÇÃO DO CLOUDFLARE TURNSTILE
-- Adiciona chave secreta na tabela app_config
-- Data: 2025-12-02
-- ============================================

-- Inserir ou atualizar chave secreta do Turnstile
INSERT INTO app_config (key, value, description)
VALUES (
  'turnstile_secret_key',
  '0x4AAAAAACD_iSbION01_i3Qx0sL5uQV0xo',
  'Chave secreta do Cloudflare Turnstile para validação de captcha no backend'
)
ON CONFLICT (key) DO UPDATE 
SET value = EXCLUDED.value,
    description = EXCLUDED.description,
    updated_at = NOW();

COMMENT ON TABLE app_config IS 
'Tabela de configurações da aplicação. Armazena chaves e valores de configuração sensíveis.';

