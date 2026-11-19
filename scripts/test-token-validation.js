/**
 * Script para testar validação de tokens
 * 
 * Uso: node scripts/test-token-validation.js
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { config } from 'dotenv';

const envPath = resolve(process.cwd(), '.env.local');
if (existsSync(envPath)) {
  config({ path: envPath });
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const OBFUSCATION_KEY = process.env.VITE_OBFUSCATION_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Erro: VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY devem estar configurados');
  process.exit(1);
}

if (!OBFUSCATION_KEY) {
  console.error('❌ Erro: VITE_OBFUSCATION_KEY deve estar configurado');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Função para gerar token (simulando frontend)
function generateToken(userId, timestamp = Date.now()) {
  const rawToken = `${userId}:${timestamp}:${OBFUSCATION_KEY}`;
  return Buffer.from(rawToken).toString('base64');
}

async function testValidation() {
  try {
    console.log('🧪 Testando validação de tokens...\n');

    // 1. Verificar chave no backend
    console.log('1️⃣ Verificando chave no backend...');
    const { data: keyStatus, error: keyError } = await supabase.rpc('get_obfuscation_key_status');
    
    if (keyError) {
      console.error('❌ Erro ao verificar chave:', keyError.message);
      return;
    }
    
    const status = keyStatus[0]?.get_obfuscation_key_status;
    console.log('   ✅ Chave configurada:', status?.is_production_ready ? 'Sim' : 'Não');
    console.log('   📏 Tamanho:', status?.key_length, 'caracteres');
    console.log('   🔑 Preview:', status?.current_key_preview);
    console.log('   📍 Fonte:', status?.source);
    
    // Verificar se chave corresponde
    const backendKey = status?.current_key_preview?.replace('...', '');
    const frontendKey = OBFUSCATION_KEY.substring(0, backendKey?.length || 16);
    
    if (backendKey !== frontendKey) {
      console.error('   ❌ Chaves não correspondem!');
      console.error('   Frontend:', frontendKey);
      console.error('   Backend:', backendKey);
      return;
    }
    console.log('   ✅ Chaves correspondem\n');

    // 2. Buscar um usuário de teste
    console.log('2️⃣ Buscando usuário de teste...');
    const { data: users, error: usersError } = await supabase
      .from('users_profiles')
      .select('id')
      .limit(1);
    
    if (usersError || !users || users.length === 0) {
      console.error('❌ Erro ao buscar usuário:', usersError?.message);
      return;
    }
    
    const testUserId = users[0].id;
    console.log('   ✅ Usuário encontrado:', testUserId.substring(0, 8) + '...\n');

    // 3. Gerar token de teste
    console.log('3️⃣ Gerando token de teste...');
    const testToken = generateToken(testUserId);
    console.log('   ✅ Token gerado:', testToken.substring(0, 30) + '...\n');

    // 4. Testar validação
    console.log('4️⃣ Testando validação...');
    const { data: validatedUserId, error: validateError } = await supabase.rpc('validate_user_token', {
      p_token: testToken
    });
    
    if (validateError) {
      console.error('   ❌ Erro na validação:', validateError.message);
      console.error('   Código:', validateError.code);
      console.error('   Detalhes:', validateError.details);
      
      // Tentar debug
      console.log('\n5️⃣ Executando debug...');
      const { data: debugData, error: debugError } = await supabase.rpc('debug_validate_user_token', {
        p_token: testToken
      });
      
      if (debugError) {
        console.error('   ❌ Erro no debug:', debugError.message);
      } else {
        console.log('   📊 Debug info:', JSON.stringify(debugData, null, 2));
      }
      return;
    }
    
    if (validatedUserId === testUserId) {
      console.log('   ✅ Validação bem-sucedida!');
      console.log('   ✅ User ID retornado:', validatedUserId);
    } else {
      console.error('   ❌ User ID não corresponde!');
      console.error('   Esperado:', testUserId);
      console.error('   Recebido:', validatedUserId);
    }

    console.log('\n✅ Teste concluído!');

  } catch (error) {
    console.error('❌ Erro:', error.message);
    console.error(error.stack);
  }
}

testValidation();

