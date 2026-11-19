-- =====================================================
-- SCRIPT: Configurar Chave de Ofuscação para Produção
-- =====================================================
-- 
-- INSTRUÇÕES:
-- 1. Execute este script no SQL Editor do Supabase
-- 2. Substitua 'SUA_CHAVE_AQUI' pela chave do seu .env.local
--    (ou use a função para gerar uma nova)
-- 3. Configure a mesma chave como variável de ambiente
--    no seu servidor de produção
--
-- =====================================================

-- OPÇÃO 1: Configurar chave manualmente
-- Substitua 'SUA_CHAVE_AQUI' pela chave do VITE_OBFUSCATION_KEY do .env.local
-- A chave deve ter pelo menos 32 caracteres
DO $$
DECLARE
  v_chave TEXT := 'SUA_CHAVE_AQUI'; -- ⚠️ SUBSTITUA AQUI
BEGIN
  -- Validar chave
  IF LENGTH(v_chave) < 32 THEN
    RAISE EXCEPTION 'Chave deve ter pelo menos 32 caracteres. Tamanho atual: %', LENGTH(v_chave);
  END IF;
  
  -- Configurar no banco
  PERFORM update_obfuscation_key(v_chave);
  
  RAISE NOTICE '✅ Chave configurada com sucesso!';
  RAISE NOTICE '   Tamanho: % caracteres', LENGTH(v_chave);
  RAISE NOTICE '   Primeiros 8 caracteres: %', SUBSTRING(v_chave, 1, 8);
END $$;

-- OPÇÃO 2: Gerar chave automaticamente (se preferir)
-- Descomente o bloco abaixo e comente a OPÇÃO 1
/*
DO $$
DECLARE
  v_chave TEXT;
BEGIN
  -- Gerar chave aleatória de 64 caracteres (32 bytes em hex)
  v_chave := encode(gen_random_bytes(32), 'hex');
  
  -- Configurar no banco
  PERFORM update_obfuscation_key(v_chave);
  
  RAISE NOTICE '✅ Chave gerada e configurada!';
  RAISE NOTICE '   Chave gerada: %', v_chave;
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  IMPORTANTE: Copie esta chave e configure no servidor de produção:';
  RAISE NOTICE '   VITE_OBFUSCATION_KEY=%', v_chave;
END $$;
*/

-- =====================================================
-- VERIFICAÇÃO
-- =====================================================

-- Verificar se a chave foi configurada corretamente
SELECT get_obfuscation_key_status() as status;

-- Verificar a chave atual (primeiros 8 caracteres apenas por segurança)
SELECT 
  SUBSTRING(get_obfuscation_key(), 1, 8) || '...' as chave_preview,
  LENGTH(get_obfuscation_key()) as tamanho
FROM get_obfuscation_key_status();

-- =====================================================
-- TESTE DE VALIDAÇÃO
-- =====================================================

-- Testar se a função de validação está funcionando
-- (substitua pelo token de um usuário válido)
/*
SELECT debug_validate_user_token('SEU_TOKEN_AQUI') as teste_validacao;
*/

-- =====================================================
-- PRÓXIMOS PASSOS
-- =====================================================
-- 
-- 1. ✅ Chave configurada no banco (você acabou de fazer)
-- 
-- 2. Configure a MESMA chave no servidor de produção:
--    - Se usar Vercel/Netlify: Configure como variável de ambiente
--    - Se usar servidor próprio: Configure no .env ou sistema de variáveis
--    - Nome da variável: VITE_OBFUSCATION_KEY
--    - Valor: A mesma chave que você configurou acima
--
-- 3. Reinicie o servidor de produção após configurar
--
-- 4. Teste o acesso às páginas protegidas
--
-- =====================================================

