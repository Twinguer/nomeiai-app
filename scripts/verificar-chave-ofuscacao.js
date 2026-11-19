/**
 * Script para verificar o status da chave de ofuscação
 * 
 * Uso: node scripts/verificar-chave-ofuscacao.js
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Carregar variáveis de ambiente
dotenv.config({ path: join(__dirname, '../.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Erro: Variáveis de ambiente VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY não encontradas');
  console.error('Certifique-se de que o arquivo .env.local existe e contém essas variáveis');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verificarChaveOfuscacao() {
  console.log('🔍 Verificando status da chave de ofuscação...\n');

  try {
    // Método 1: Usar função get_obfuscation_key_status()
    console.log('📊 Método 1: Usando função get_obfuscation_key_status()');
    const { data: statusData, error: statusError } = await supabase.rpc('get_obfuscation_key_status');
    
    if (statusError) {
      console.error('❌ Erro ao executar função:', statusError.message);
    } else {
      console.log('Resultado:', JSON.stringify(statusData, null, 2));
      
      if (statusData?.configured === false) {
        console.log('\n⚠️  ATENÇÃO: Chave não configurada ou usando valor padrão!');
        console.log('📝 Execute no SQL Editor do Supabase:');
        console.log("   SELECT update_obfuscation_key('sua_chave_segura_minimo_32_caracteres_aqui');");
      } else {
        console.log('\n✅ Chave parece estar configurada');
      }
    }

    console.log('\n' + '='.repeat(60) + '\n');

    // Método 2: Verificar diretamente na tabela app_config
    console.log('📊 Método 2: Verificando tabela app_config diretamente');
    const { data: configData, error: configError } = await supabase
      .from('app_config')
      .select('key, value, updated_at')
      .eq('key', 'obfuscation_key')
      .single();

    if (configError) {
      if (configError.code === 'PGRST116') {
        console.log('⚠️  Registro não encontrado na tabela app_config');
        console.log('   A chave pode estar usando o valor padrão ou variável de ambiente');
      } else {
        console.error('❌ Erro ao consultar app_config:', configError.message);
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
      } else if (tamanho < 32) {
        console.log('\n⚠️  ATENÇÃO: Chave muito curta (mínimo 32 caracteres)');
      } else {
        console.log('\n✅ Chave configurada corretamente');
      }
    }

    console.log('\n' + '='.repeat(60) + '\n');

    // Método 3: Tentar executar função get_obfuscation_key (pode não estar exposta)
    console.log('📊 Método 3: Tentando verificar via função get_obfuscation_key()');
    try {
      const { data: keyData, error: keyError } = await supabase.rpc('get_obfuscation_key');
      
      if (keyError) {
        console.log('⚠️  Função não acessível via RPC (normal, é SECURITY DEFINER)');
        console.log('   Execute diretamente no SQL Editor: SELECT get_obfuscation_key();');
      } else {
        const chave = keyData;
        if (chave === 'default_obfuscation_key_change_in_production') {
          console.log('❌ CRÍTICO: Função retorna chave padrão insegura!');
        } else {
          console.log('✅ Função retorna chave configurada');
          console.log('   Preview:', chave.substring(0, 10) + '...');
        }
      }
    } catch (err) {
      console.log('⚠️  Não foi possível executar função (normal se não estiver exposta)');
    }

  } catch (error) {
    console.error('❌ Erro geral:', error.message);
    process.exit(1);
  }

  console.log('\n✅ Verificação concluída!');
  console.log('\n📝 Se a chave precisar ser atualizada, execute no SQL Editor do Supabase:');
  console.log("   SELECT update_obfuscation_key('sua_chave_segura_minimo_32_caracteres_aqui');");
}

verificarChaveOfuscacao();

