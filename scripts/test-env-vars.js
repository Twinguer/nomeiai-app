// Script para testar se as variáveis de ambiente estão configuradas
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

console.log('🔍 Verificando variáveis de ambiente...\n');

// Verificar arquivo .env.local
try {
  const envLocal = readFileSync(join(rootDir, '.env.local'), 'utf-8');
  const requiredVars = [
    'VITE_URL_OBFUSCATION_KEY',
    'VITE_OBFUSCATION_KEY',
    'VITE_ADMIN_OBFUSCATION_KEY',
    'VITE_COMMUNITY_OBFUSCATION_KEY'
  ];

  console.log('📄 Arquivo .env.local encontrado\n');
  
  let allPresent = true;
  requiredVars.forEach(varName => {
    const regex = new RegExp(`^${varName}=(.+)$`, 'm');
    const match = envLocal.match(regex);
    
    if (match && match[1] && match[1].trim().length > 0) {
      const keyLength = match[1].trim().length;
      const status = keyLength >= 32 ? '✅' : '⚠️';
      console.log(`${status} ${varName}: ${keyLength} caracteres`);
    } else {
      console.log(`❌ ${varName}: NÃO ENCONTRADA`);
      allPresent = false;
    }
  });

  console.log('\n' + '='.repeat(50));
  if (allPresent) {
    console.log('✅ Todas as variáveis de ofuscação estão configuradas!');
  } else {
    console.log('❌ Algumas variáveis estão faltando.');
  }
} catch (error) {
  console.error('❌ Erro ao ler .env.local:', error.message);
  console.log('\n💡 Execute: node switch-database.js nomeia-ai');
}

