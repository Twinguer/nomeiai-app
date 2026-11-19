-- =====================================================
-- Script para configurar chave de ofuscação no Supabase
-- =====================================================
-- 
-- INSTRUÇÕES:
-- 1. Abra o Supabase Dashboard
-- 2. Vá em Settings > Database > Custom Config
-- 3. Adicione: app.obfuscation_key = 'SUA_CHAVE_AQUI'
-- 
-- OU execute este script substituindo 'SUA_CHAVE_AQUI' pela chave real
-- =====================================================

-- Opção 1: Atualizar via tabela (funciona imediatamente)
-- Substitua 'SUA_CHAVE_AQUI' pelo valor de VITE_OBFUSCATION_KEY do .env.local
SELECT update_obfuscation_key('SUA_CHAVE_AQUI');

-- Opção 2: Verificar status atual
SELECT get_obfuscation_key_status();

-- Opção 3: Verificar chave atual
SELECT get_obfuscation_key() as chave_atual;

-- =====================================================
-- IMPORTANTE PARA PRODUÇÃO:
-- =====================================================
-- Configure também a variável de ambiente no Supabase Dashboard:
-- Settings > Database > Custom Config > app.obfuscation_key
-- 
-- Isso é mais seguro que usar apenas a tabela.
-- =====================================================

