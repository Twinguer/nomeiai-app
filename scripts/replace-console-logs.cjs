#!/usr/bin/env node

/**
 * Script para substituir console.logs por devLog
 * Uso: node scripts/replace-console-logs.cjs
 */

const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, '..', 'src');
const IMPORT_STATEMENT = "import { devLog, sanitizeForLog } from '@/utils/productionLogger';";

// Padrões de console para substituir
const CONSOLE_PATTERNS = [
  { pattern: /console\.log\(/g, replacement: 'devLog.log(' },
  { pattern: /console\.error\(/g, replacement: 'devLog.error(' },
  { pattern: /console\.warn\(/g, replacement: 'devLog.warn(' },
  { pattern: /console\.debug\(/g, replacement: 'devLog.debug(' },
  { pattern: /console\.info\(/g, replacement: 'devLog.info(' },
];

// Arquivos que não devem ser modificados (já usam logger correto)
const EXCLUDE_FILES = [
  'productionLogger.ts',
  'secureLogger.ts',
  'logger.ts',
  'serverLogger.ts',
  'clientLogger.ts',
];

function getAllTsFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      getAllTsFiles(filePath, fileList);
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      const relativePath = path.relative(SRC_DIR, filePath);
      if (!EXCLUDE_FILES.some(excluded => relativePath.includes(excluded))) {
        fileList.push(filePath);
      }
    }
  });
  
  return fileList;
}

function hasConsoleLogs(content) {
  return CONSOLE_PATTERNS.some(({ pattern }) => pattern.test(content));
}

function hasImport(content, importStatement) {
  return content.includes(importStatement);
}

function addImport(content) {
  // Encontrar a última importação
  const importRegex = /^import\s+.*?from\s+['"].*?['"];?$/gm;
  const imports = content.match(importRegex) || [];
  
  if (imports.length === 0) {
    // Se não há imports, adicionar no início
    return `${IMPORT_STATEMENT}\n${content}`;
  }
  
  // Verificar se já tem o import
  if (hasImport(content, IMPORT_STATEMENT)) {
    return content;
  }
  
  // Adicionar após a última importação
  const lastImport = imports[imports.length - 1];
  const lastImportIndex = content.lastIndexOf(lastImport);
  const afterLastImport = lastImportIndex + lastImport.length;
  
  return content.slice(0, afterLastImport) + '\n' + IMPORT_STATEMENT + content.slice(afterLastImport);
}

function replaceConsoleLogs(content) {
  let newContent = content;
  
  CONSOLE_PATTERNS.forEach(({ pattern, replacement }) => {
    newContent = newContent.replace(pattern, replacement);
  });
  
  return newContent;
}

function processFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    if (!hasConsoleLogs(content)) {
      return { modified: false, file: filePath };
    }
    
    let newContent = content;
    
    // Adicionar import se necessário
    if (!hasImport(newContent, IMPORT_STATEMENT)) {
      newContent = addImport(newContent);
    }
    
    // Substituir console.logs
    newContent = replaceConsoleLogs(newContent);
    
    // Salvar arquivo
    fs.writeFileSync(filePath, newContent, 'utf8');
    
    return { modified: true, file: filePath };
  } catch (error) {
    console.error(`Erro ao processar ${filePath}:`, error.message);
    return { modified: false, file: filePath, error: error.message };
  }
}

function main() {
  console.log('🔍 Procurando arquivos com console.logs...\n');
  
  const files = getAllTsFiles(SRC_DIR);
  console.log(`📁 Encontrados ${files.length} arquivos TypeScript\n`);
  
  const results = files.map(processFile);
  const modified = results.filter(r => r.modified);
  const errors = results.filter(r => r.error);
  
  console.log(`\n✅ Processamento concluído:`);
  console.log(`   - Arquivos modificados: ${modified.length}`);
  console.log(`   - Arquivos sem alterações: ${results.length - modified.length - errors.length}`);
  console.log(`   - Erros: ${errors.length}`);
  
  if (modified.length > 0) {
    console.log(`\n📝 Arquivos modificados:`);
    modified.forEach(({ file }) => {
      console.log(`   - ${path.relative(SRC_DIR, file)}`);
    });
  }
  
  if (errors.length > 0) {
    console.log(`\n❌ Erros:`);
    errors.forEach(({ file, error }) => {
      console.log(`   - ${path.relative(SRC_DIR, file)}: ${error}`);
    });
  }
  
  console.log(`\n⚠️  IMPORTANTE: Revise os arquivos modificados antes de fazer commit!`);
  console.log(`   Alguns console.logs podem precisar de ajustes manuais.`);
}

if (require.main === module) {
  main();
}

module.exports = { processFile, getAllTsFiles };


