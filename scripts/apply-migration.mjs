#!/usr/bin/env node
/**
 * Script para aplicar migração SQL via Supabase
 * 
 * Uso: node scripts/apply-migration.mjs <caminho-do-arquivo-migration.sql>
 * 
 * Requisitos:
 * - Arquivo .env.local com VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY
 * - OU variáveis de ambiente VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY
 * 
 * NOTA: Este script requer a função exec_sql no banco de dados.
 * Se não funcionar, aplique a migração manualmente via Supabase Dashboard > SQL Editor
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
  console.log('⚠️  Arquivo .env.local não encontrado, usando variáveis de ambiente do sistema');
}

const supabaseUrl = envVars.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = envVars.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Erro: Variáveis de ambiente não encontradas');
  console.error('   VITE_SUPABASE_URL:', supabaseUrl ? '✅' : '❌');
  console.error('   VITE_SUPABASE_ANON_KEY:', supabaseKey ? '✅' : '❌');
  console.error('\n📝 Configure no arquivo .env.local ou como variáveis de ambiente');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Obter caminho do arquivo de migração
const migrationPath = process.argv[2];

if (!migrationPath) {
  console.error('❌ Uso: node scripts/apply-migration.mjs <caminho-do-arquivo-migration.sql>');
  console.error('\nExemplo:');
  console.error('  node scripts/apply-migration.mjs supabase/migrations/20250120000010_fix_apply_voucher_uses_count.sql');
  process.exit(1);
}

async function applyMigration() {
  console.log('📄 Lendo arquivo de migração:', migrationPath);
  
  let sqlContent;
  try {
    sqlContent = readFileSync(migrationPath, 'utf8');
  } catch (error) {
    console.error('❌ Erro ao ler arquivo:', error.message);
    process.exit(1);
  }

  if (!sqlContent.trim()) {
    console.error('❌ Arquivo de migração está vazio');
    process.exit(1);
  }

  console.log('📡 Conectando ao Supabase:', supabaseUrl.substring(0, 40) + '...');
  console.log('📊 Tamanho do SQL:', sqlContent.length, 'caracteres');
  console.log('\n⚠️  ATENÇÃO: Este script tenta executar SQL via função exec_sql');
  console.log('   Se falhar, aplique manualmente via Supabase Dashboard > SQL Editor\n');

  try {
    // Tentar executar via função exec_sql (se existir)
    console.log('🔄 Executando migração via RPC exec_sql...');
    const { data, error } = await supabase.rpc('exec_sql', { sql: sqlContent });

    if (error) {
      console.error('❌ Erro ao executar migração:', error.message);
      console.error('   Código:', error.code);
      console.error('   Detalhes:', error.details);
      console.error('\n📝 SOLUÇÃO: Aplique a migração manualmente:');
      console.log('   1. Acesse: https://supabase.com/dashboard/project/ppsymqrdtjyaguftracc/sql/new');
      console.log('   2. Cole o conteúdo do arquivo:', migrationPath);
      console.log('   3. Clique em "Run"');
      process.exit(1);
    }

    console.log('✅ Migração executada com sucesso!');
    console.log('   Resultado:', data);
    
  } catch (error) {
    console.error('❌ Erro fatal:', error.message);
    console.error('\n📝 SOLUÇÃO: Aplique a migração manualmente:');
    console.log('   1. Acesse: https://supabase.com/dashboard/project/ppsymqrdtjyaguftracc/sql/new');
    console.log('   2. Cole o conteúdo do arquivo:', migrationPath);
    console.log('   3. Clique em "Run"');
    process.exit(1);
  }
}

applyMigration().catch(error => {
  console.error('❌ Erro inesperado:', error);
  process.exit(1);
});
