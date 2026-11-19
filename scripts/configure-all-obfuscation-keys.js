/**
 * Script para gerar e configurar todas as chaves de ofuscação
 * 
 * Uso: node scripts/configure-all-obfuscation-keys.js
 * 
 * Este script:
 * 1. Gera chaves seguras se não existirem
 * 2. Configura no backend via RPC
 * 3. Cria/atualiza .env.local
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { config } from 'dotenv';
import { randomBytes } from 'crypto';

// Carregar variáveis de ambiente existentes
const envPath = resolve(process.cwd(), '.env.local');
if (existsSync(envPath)) {
  config({ path: envPath });
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Erro: VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY devem estar configurados');
  console.error('   Configure no .env.local ou como variáveis de ambiente');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Função para gerar chave segura
function generateSecureKey(length = 32) {
  return randomBytes(length).toString('hex');
}

// Função para ler ou gerar chave
function getOrGenerateKey(envVar, description) {
  const existing = process.env[envVar];
  if (existing && existing.length >= 32) {
    console.log(`✅ ${description}: Usando chave existente (${existing.substring(0, 8)}...)`);
    return existing;
  }
  
  const newKey = generateSecureKey(32);
  console.log(`🔑 ${description}: Gerando nova chave (${newKey.substring(0, 8)}...)`);
  return newKey;
}

async function configureKeys() {
  try {
    console.log('🔐 Configurando chaves de ofuscação...\n');

    // ⚠️ IMPORTANTE: O backend usa uma única chave para todas as validações
    // Portanto, todas as chaves do frontend devem ser iguais
    // Gerar ou usar chave principal
    const mainKey = getOrGenerateKey('VITE_OBFUSCATION_KEY', 'Chave principal (usada para todos os tipos)');
    
    // Usar a mesma chave para todos os tipos
    const keys = {
      VITE_OBFUSCATION_KEY: mainKey,
      VITE_URL_OBFUSCATION_KEY: mainKey,
      VITE_ADMIN_OBFUSCATION_KEY: mainKey,
      VITE_COMMUNITY_OBFUSCATION_KEY: mainKey,
    };
    
    console.log('   ⚠️  Todas as chaves serão iguais (backend usa uma única chave)');

    // ⚠️ IMPORTANTE: O backend atualmente usa uma única chave (VITE_OBFUSCATION_KEY)
    // Vamos configurar essa chave principal no backend
    console.log('\n📤 Configurando chave principal no backend...');
    
    const { data: updateResult, error: updateError } = await supabase.rpc('update_obfuscation_key', {
      p_new_key: keys.VITE_OBFUSCATION_KEY
    });

    if (updateError) {
      console.error('❌ Erro ao atualizar chave no backend:', updateError.message);
      console.error('   Verifique se a função update_obfuscation_key existe no banco');
      process.exit(1);
    }

    console.log('✅ Chave principal configurada no backend');

    // Verificar status
    console.log('\n🔍 Verificando configuração...');
    const { data: status, error: statusError } = await supabase.rpc('get_obfuscation_key_status');

    if (statusError) {
      console.warn('⚠️  Não foi possível verificar status:', statusError.message);
    } else {
      const statusData = status[0]?.get_obfuscation_key_status;
      console.log(`   Fonte: ${statusData?.source || 'N/A'}`);
      console.log(`   Tamanho: ${statusData?.key_length || 'N/A'} caracteres`);
      console.log(`   Pronto para produção: ${statusData?.is_production_ready ? '✅' : '❌'}`);
    }

    // Atualizar .env.local
    console.log('\n📝 Atualizando .env.local...');
    
    let envContent = '';
    if (existsSync(envPath)) {
      envContent = readFileSync(envPath, 'utf-8');
    }

    // Atualizar ou adicionar cada chave
    const envVars = [
      'VITE_SUPABASE_URL',
      'VITE_SUPABASE_ANON_KEY',
      'VITE_OBFUSCATION_KEY',
      'VITE_URL_OBFUSCATION_KEY',
      'VITE_ADMIN_OBFUSCATION_KEY',
      'VITE_COMMUNITY_OBFUSCATION_KEY',
    ];

    envVars.forEach(varName => {
      const value = varName.startsWith('VITE_') && keys[varName] 
        ? keys[varName] 
        : process.env[varName] || '';

      if (value) {
        const regex = new RegExp(`^${varName}=.*$`, 'm');
        if (regex.test(envContent)) {
          envContent = envContent.replace(regex, `${varName}=${value}`);
        } else {
          envContent += `\n${varName}=${value}`;
        }
      }
    });

    // Garantir que há uma linha em branco no final
    if (!envContent.endsWith('\n')) {
      envContent += '\n';
    }

    writeFileSync(envPath, envContent, 'utf-8');
    console.log('✅ .env.local atualizado');

    console.log('\n✅ Configuração concluída!');
    console.log('\n📋 Próximos passos:');
    console.log('   1. Reinicie o servidor de desenvolvimento');
    console.log('   2. Teste o acesso às páginas protegidas');
    console.log('   3. Se ainda houver problemas, verifique:');
    console.log('      - SELECT get_obfuscation_key_status();');
    console.log('      - SELECT debug_validate_user_token(\'seu_token\');');
    console.log('\n⚠️  IMPORTANTE: Em produção, configure app.obfuscation_key no Supabase Dashboard');
    console.log('   Settings > Database > Custom Config');

  } catch (error) {
    console.error('❌ Erro:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

configureKeys();

