-- =====================================================
-- VERIFICAÇÃO DA CHAVE DE OFUSCAÇÃO
-- Execute este script no Supabase SQL Editor
-- =====================================================

-- Método 1: Usar função de status (recomendado)
SELECT get_obfuscation_key_status() as status_completo;

-- Método 2: Verificar diretamente na tabela app_config
SELECT 
  key,
  CASE 
    WHEN value = 'default_obfuscation_key_change_in_production' THEN '⚠️ CHAVE PADRÃO (INSEGURO)'
    WHEN value IS NULL OR value = '' THEN '❌ CHAVE NÃO CONFIGURADA'
    WHEN length(value) < 32 THEN '⚠️ CHAVE MUITO CURTA (mínimo 32 caracteres)'
    ELSE '✅ Chave configurada corretamente'
  END as status,
  length(value) as tamanho_caracteres,
  left(value, 10) || '...' as preview_primeiros_10_chars,
  updated_at as ultima_atualizacao
FROM app_config
WHERE key = 'obfuscation_key';

-- Método 3: Verificar função get_obfuscation_key()
SELECT 
  get_obfuscation_key() as chave_retornada,
  CASE 
    WHEN get_obfuscation_key() = 'default_obfuscation_key_change_in_production' 
    THEN '⚠️ ATENÇÃO: Usando chave padrão insegura!'
    WHEN length(get_obfuscation_key()) < 32 
    THEN '⚠️ ATENÇÃO: Chave muito curta!'
    ELSE '✅ Chave parece estar configurada'
  END as status_funcao;

-- Método 4: Verificar se existe registro na tabela
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM app_config WHERE key = 'obfuscation_key') 
    THEN '✅ Registro existe na tabela app_config'
    ELSE '❌ Registro NÃO existe na tabela app_config'
  END as existe_registro;

-- =====================================================
-- SE A CHAVE ESTIVER COM VALOR PADRÃO, EXECUTE:
-- =====================================================
-- SELECT update_obfuscation_key('sua_chave_segura_aqui_minimo_32_caracteres');
-- 
-- Exemplo de chave segura (gere uma única vez e guarde em local seguro):
-- SELECT update_obfuscation_key('a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6');
-- =====================================================

