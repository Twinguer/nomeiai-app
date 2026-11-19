/**
 * Script para sincronizar chave de ofuscação entre frontend e backend
 * 
 * Uso: node scripts/sync-obfuscation-key.js
 * 
 * Este script lê a chave do .env.local e atualiza no Supabase
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { config } from 'dotenv';

// Carregar variáveis de ambiente
config({ path: resolve(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const OBFUSCATION_KEY = process.env.VITE_OBFUSCATION_KEY || 'dev_fallback_key_not_secure_change_in_production';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Erro: VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY devem estar configurados');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function syncKey() {
  try {
    console.log('🔄 Sincronizando chave de ofuscação...');
    console.log(`📝 Chave do frontend: ${OBFUSCATION_KEY.substring(0, 10)}...`);
    
    // Atualizar chave no backend
    const { data, error } = await supabase.rpc('update_obfuscation_key', {
      p_new_key: OBFUSCATION_KEY
    });
    
    if (error) {
      console.error('❌ Erro ao atualizar chave:', error.message);
      process.exit(1);
    }
    
    // Verificar se foi atualizada
    const { data: configData, error: configError } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', 'obfuscation_key')
      .single();
    
    if (configError) {
      console.error('❌ Erro ao verificar chave:', configError.message);
      process.exit(1);
    }
    
    console.log('✅ Chave sincronizada com sucesso!');
    console.log(`✅ Chave no backend: ${configData.value.substring(0, 10)}...`);
    
    if (configData.value === OBFUSCATION_KEY) {
      console.log('✅ Chaves estão sincronizadas!');
    } else {
      console.warn('⚠️  Chaves não coincidem. Verifique a configuração.');
    }
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

syncKey();

