#!/usr/bin/env node

/**
 * Script para alternar entre bancos de dados
 * Uso: node switch-database.js [nomeia-ai|convoca-ai]
 */

import fs from 'fs';
import path from 'path';

const args = process.argv.slice(2);
const targetDatabase = args[0];

if (!targetDatabase || !['nomeia-ai', 'convoca-ai'].includes(targetDatabase)) {
  console.log('❌ Uso: node switch-database.js [nomeia-ai|convoca-ai]');
  console.log('');
  console.log('Exemplos:');
  console.log('  node switch-database.js nomeia-ai    # Usar banco de desenvolvimento');
  console.log('  node switch-database.js convoca-ai   # Usar banco de produção');
  process.exit(1);
}

const sourceFile = `env.${targetDatabase}`;
const targetFile = '.env.local';

try {
  // Verificar se o arquivo fonte existe
  if (!fs.existsSync(sourceFile)) {
    console.log(`❌ Arquivo ${sourceFile} não encontrado!`);
    process.exit(1);
  }

  // Fazer backup do arquivo atual se existir (em diretório temporário)
  if (fs.existsSync(targetFile)) {
    // Criar diretório temp se não existir
    const tempDir = './temp';
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const backupFile = `${tempDir}/.env.local.backup.${Date.now()}`;
    fs.copyFileSync(targetFile, backupFile);
    console.log(`📁 Backup criado em diretório temporário: ${backupFile}`);
    console.log(`⚠️  ATENÇÃO: Backup contém informações sensíveis - não commite!`);
  }

  // Copiar o arquivo de configuração
  fs.copyFileSync(sourceFile, targetFile);
  
  console.log(`✅ Banco alterado para: ${targetDatabase}`);
  console.log(`📄 Arquivo ativo: ${targetFile}`);
  console.log('');
  console.log('🚀 Para aplicar as mudanças, reinicie o servidor de desenvolvimento:');
  console.log('   npm run dev');
  
} catch (error) {
  console.log(`❌ Erro ao alternar banco: ${error.message}`);
  process.exit(1);
}
