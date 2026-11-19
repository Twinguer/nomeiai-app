#!/usr/bin/env node
/**
 * Script para verificar o status da chave de ofuscação via Supabase
 * 
 * Uso: node scripts/verificar-chave-ofuscacao.mjs
 * 
 * Requisitos:
 * - Arquivo .env.local com VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Carregar variáveis de ambiente do .env.local
let envVars = {};
try {
  const envFile = readFileSync(join(__dirname, '../.env.local'), 'utf8');
  envFile.split('\n').forEach(line => {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^["']|["']$/g, '');
      envVars[key] = value;
    }
  });
} catch (error) {
  console.error('❌ Erro ao ler .env.local:', error.message);
  console.error('Certifique-se de que o arquivo .env.local existe na raiz do projeto');
  process.exit(1);
}

const supabaseUrl = envVars.VITE_SUPABASE_URL;
const supabaseKey = envVars.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Erro: Variáveis de ambiente não encontradas');
  console.error('   VITE_SUPABASE_URL:', supabaseUrl ? '✅' : '❌');
  console.error('   VITE_SUPABASE_ANON_KEY:', supabaseKey ? '✅' : '❌');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verificarChaveOfuscacao() {
  console.log('🔍 Verificando status da chave de ofuscação...\n');
  console.log('📡 Conectando ao Supabase:', supabaseUrl.substring(0, 40) + '...\n');

  try {
    // Método 1: Usar função get_obfuscation_key_status()
    console.log('📊 Método 1: Usando função get_obfuscation_key_status()');
    console.log('─'.repeat(60));
    
    const { data: statusData, error: statusError } = await supabase.rpc('get_obfuscation_key_status');
    
    if (statusError) {
      console.error('❌ Erro ao executar função:', statusError.message);
      console.error('   Código:', statusError.code);
    } else {
      console.log('✅ Resultado:', JSON.stringify(statusData, null, 2));
      
      if (statusData?.configured === false) {
        console.log('\n⚠️  ATENÇÃO: Chave não configurada ou usando valor padrão!');
        console.log('📝 Para corrigir, execute no SQL Editor do Supabase:');
        console.log("   SELECT update_obfuscation_key('sua_chave_segura_minimo_32_caracteres_aqui');");
      } else {
        console.log('\n✅ Chave parece estar configurada');
        console.log('   Preview:', statusData?.key_preview || 'N/A');
      }
    }

    console.log('\n' + '='.repeat(60) + '\n');

    // Método 2: Verificar diretamente na tabela app_config
    console.log('📊 Método 2: Verificando tabela app_config diretamente');
    console.log('─'.repeat(60));
    
    const { data: configData, error: configError } = await supabase
      .from('app_config')
      .select('key, value, updated_at')
      .eq('key', 'obfuscation_key')
      .single();

    if (configError) {
      if (configError.code === 'PGRST116') {
        console.log('⚠️  Registro não encontrado na tabela app_config');
        console.log('   A chave pode estar usando o valor padrão ou variável de ambiente');
        console.log('   Verifique executando: SELECT get_obfuscation_key(); no SQL Editor');
      } else {
        console.error('❌ Erro ao consultar app_config:', configError.message);
        console.error('   Código:', configError.code);
      }
    } else {
      const chave = configData.value;
      const tamanho = chave.length;
      const preview = chave.substring(0, 10) + '...';
      
      console.log('📋 Dados encontrados:');
      console.log('   Key:', configData.key);
      console.log('   Tamanho:', tamanho, 'caracteres');
      console.log('   Preview:', preview);
      console.log('   Última atualização:', configData.updated_at);
      
      if (chave === 'default_obfuscation_key_change_in_production') {
        console.log('\n❌ CRÍTICO: Usando chave padrão insegura!');
        console.log('📝 Execute no SQL Editor do Supabase:');
        console.log("   SELECT update_obfuscation_key('sua_chave_segura_minimo_32_caracteres_aqui');");
        console.log('\n💡 Dica: Gere uma chave segura com pelo menos 32 caracteres aleatórios');
      } else if (tamanho < 32) {
        console.log('\n⚠️  ATENÇÃO: Chave muito curta (mínimo 32 caracteres)');
        console.log('   Tamanho atual:', tamanho);
        console.log('   Tamanho recomendado: 32+ caracteres');
      } else {
        console.log('\n✅ Chave configurada corretamente');
        console.log('   Tamanho:', tamanho, 'caracteres (adequado)');
      }
    }

  } catch (error) {
    console.error('❌ Erro geral:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ Verificação concluída!');
  console.log('\n📝 Se a chave precisar ser atualizada:');
  console.log('   1. Acesse o Supabase Dashboard');
  console.log('   2. Vá em SQL Editor');
  console.log('   3. Execute: SELECT update_obfuscation_key(\'sua_chave_segura_aqui\');');
  console.log('   4. Verifique novamente com este script');
}

verificarChaveOfuscacao().catch(error => {
  console.error('❌ Erro fatal:', error);
  process.exit(1);
});

