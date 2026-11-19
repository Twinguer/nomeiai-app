/**
 * Script para extrair a chave de ofuscação do .env.local
 * e gerar o comando SQL para configurar no banco
 * 
 * Uso: 
 *   npm run config:obfuscation-key
 *   ou
 *   node scripts/get-obfuscation-key-from-env.js
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { config } from 'dotenv';

// Carregar .env.local
const envPath = resolve(process.cwd(), '.env.local');
if (!existsSync(envPath)) {
  console.error('❌ Arquivo .env.local não encontrado');
  console.error('   Crie o arquivo .env.local com VITE_OBFUSCATION_KEY');
  process.exit(1);
}

config({ path: envPath });

const obfuscationKey = process.env.VITE_OBFUSCATION_KEY;

if (!obfuscationKey) {
  console.error('❌ VITE_OBFUSCATION_KEY não encontrada no .env.local');
  console.error('   Adicione: VITE_OBFUSCATION_KEY=sua_chave_aqui');
  process.exit(1);
}

if (obfuscationKey.length < 32) {
  console.warn('⚠️  Chave muito curta (mínimo 32 caracteres recomendado)');
  console.warn(`   Tamanho atual: ${obfuscationKey.length} caracteres\n`);
}

console.log('🔑 Chave encontrada no .env.local\n');
console.log('📋 Execute este SQL no Supabase SQL Editor:\n');
console.log('='.repeat(70));
console.log('');
console.log('-- Configurar chave de ofuscação no banco');
console.log('DO $$');
console.log('DECLARE');
console.log(`  v_chave TEXT := '${obfuscationKey}';`);
console.log('BEGIN');
console.log('  PERFORM update_obfuscation_key(v_chave);');
console.log("  RAISE NOTICE '✅ Chave configurada com sucesso!';");
console.log('  RAISE NOTICE \'   Tamanho: % caracteres\', LENGTH(v_chave);');
console.log('END $$;');
console.log('');
console.log('-- Verificar configuração');
console.log('SELECT get_obfuscation_key_status() as status;');
console.log('');
console.log('='.repeat(70));
console.log('');
console.log('📝 INSTRUÇÕES:');
console.log('');
console.log('1. ✅ Copie o SQL acima e execute no Supabase SQL Editor');
console.log('2. ⚠️  Configure a MESMA chave no servidor de produção:');
console.log(`   VITE_OBFUSCATION_KEY=${obfuscationKey}`);
console.log('');
console.log('3. 🔄 Reinicie o servidor de produção após configurar');
console.log('');
console.log('4. ✅ Teste o acesso às páginas protegidas');
console.log('');
console.log('💡 Dica: Como você usa o mesmo banco para dev e produção,');
console.log('   a chave no banco já estará configurada após executar o SQL.');
console.log('   Você só precisa configurar a variável de ambiente no servidor.');
