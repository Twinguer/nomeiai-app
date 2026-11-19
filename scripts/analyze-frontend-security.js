/**
 * Script para analisar exposição de dados sensíveis no frontend
 * Verifica: console.logs, localStorage, props, keys do React, URLs
 */

const fs = require('fs');
const path = require('path');

const issues = {
  consoleLogs: [],
  localStorage: [],
  exposedIds: [],
  reactKeys: [],
  urlParams: [],
  jsonStringify: []
};

function getAllFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      // Ignorar node_modules, .git, dist, build
      if (!['node_modules', '.git', 'dist', 'build', '.next'].includes(file)) {
        getAllFiles(filePath, fileList);
      }
    } else if (file.endsWith('.tsx') || file.endsWith('.ts') || file.endsWith('.jsx') || file.endsWith('.js')) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

function analyzeFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const relativePath = path.relative(process.cwd(), filePath);
  
  lines.forEach((line, index) => {
    const lineNum = index + 1;
    
    // 1. Console.logs diretos (não usando productionLogger)
    if (line.match(/console\.(log|warn|error|debug)\s*\(/)) {
      // Verificar se não está usando devLog ou sanitizeForLog
      if (!line.includes('devLog') && !line.includes('sanitizeForLog') && !line.includes('productionLogger')) {
        // Verificar se contém dados sensíveis
        if (line.match(/user(id|Id|_id)|userId|token|email|password|cpf|phone/i)) {
          issues.consoleLogs.push({
            file: relativePath,
            line: lineNum,
            code: line.trim(),
            severity: 'HIGH',
            issue: 'Console.log direto com dados sensíveis'
          });
        } else {
          issues.consoleLogs.push({
            file: relativePath,
            line: lineNum,
            code: line.trim(),
            severity: 'MEDIUM',
            issue: 'Console.log direto (deve usar productionLogger)'
          });
        }
      }
    }
    
    // 2. JSON.stringify de dados completos
    if (line.match(/JSON\.stringify\s*\([^)]*user(id|Id|_id|userId|token|email)/i)) {
      issues.jsonStringify.push({
        file: relativePath,
        line: lineNum,
        code: line.trim(),
        severity: 'HIGH',
        issue: 'JSON.stringify de dados sensíveis'
      });
    }
    
    // 3. User IDs em keys do React
    if (line.match(/key\s*=\s*\{[^}]*\.(userId|user_id|id)\}/)) {
      issues.reactKeys.push({
        file: relativePath,
        line: lineNum,
        code: line.trim(),
        severity: 'HIGH',
        issue: 'User ID exposto em key do React (visível no DOM)'
      });
    }
    
    // 4. User IDs sendo passados diretamente em props
    if (line.match(/(userId|user_id)\s*[:=]\s*[^,}\]]*\.(userId|user_id|id)/)) {
      if (!line.includes('validateUserToken') && !line.includes('generateSecure')) {
        issues.exposedIds.push({
          file: relativePath,
          line: lineNum,
          code: line.trim(),
          severity: 'MEDIUM',
          issue: 'User ID sendo passado diretamente (verificar se precisa ofuscação)'
        });
      }
    }
    
    // 5. localStorage com dados sensíveis
    if (line.match(/localStorage\.(setItem|getItem)\s*\([^)]*(token|password|email|user(id|Id|_id))/i)) {
      issues.localStorage.push({
        file: relativePath,
        line: lineNum,
        code: line.trim(),
        severity: 'HIGH',
        issue: 'Dados sensíveis em localStorage'
      });
    }
    
    // 6. URL params com IDs
    if (line.match(/(useParams|URLSearchParams|searchParams|query)\s*.*(userId|user_id|id)/i)) {
      if (!line.includes('validate') && !line.includes('token')) {
        issues.urlParams.push({
          file: relativePath,
          line: lineNum,
          code: line.trim(),
          severity: 'MEDIUM',
          issue: 'ID sendo extraído de URL params (verificar se precisa validação)'
        });
      }
    }
  });
}

// Analisar arquivos
const srcDir = path.join(process.cwd(), 'src');
const files = getAllFiles(srcDir);

console.log(`🔍 Analisando ${files.length} arquivos...\n`);

files.forEach(file => {
  try {
    analyzeFile(file);
  } catch (error) {
    console.error(`Erro ao analisar ${file}:`, error.message);
  }
});

// Gerar relatório
console.log('='.repeat(80));
console.log('📊 RELATÓRIO DE ANÁLISE DE SEGURANÇA - FRONTEND');
console.log('='.repeat(80));
console.log();

const totalIssues = 
  issues.consoleLogs.length + 
  issues.localStorage.length + 
  issues.exposedIds.length + 
  issues.reactKeys.length + 
  issues.urlParams.length + 
  issues.jsonStringify.length;

console.log(`Total de problemas encontrados: ${totalIssues}\n`);

// Console.logs
if (issues.consoleLogs.length > 0) {
  console.log(`\n🔴 CONSOLE.LOGS DIRETOS (${issues.consoleLogs.length} problemas):`);
  const high = issues.consoleLogs.filter(i => i.severity === 'HIGH');
  const medium = issues.consoleLogs.filter(i => i.severity === 'MEDIUM');
  
  if (high.length > 0) {
    console.log(`\n  ⚠️  ALTA SEVERIDADE (${high.length}):`);
    high.slice(0, 10).forEach(issue => {
      console.log(`    ${issue.file}:${issue.line} - ${issue.issue}`);
      console.log(`      ${issue.code.substring(0, 100)}...`);
    });
  }
  
  if (medium.length > 0) {
    console.log(`\n  ⚠️  MÉDIA SEVERIDADE (${medium.length}):`);
    medium.slice(0, 5).forEach(issue => {
      console.log(`    ${issue.file}:${issue.line}`);
    });
  }
}

// React Keys
if (issues.reactKeys.length > 0) {
  console.log(`\n🔴 USER IDs EM KEYS DO REACT (${issues.reactKeys.length} problemas):`);
  issues.reactKeys.forEach(issue => {
    console.log(`  ${issue.file}:${issue.line}`);
    console.log(`    ${issue.code}`);
  });
}

// JSON.stringify
if (issues.jsonStringify.length > 0) {
  console.log(`\n🔴 JSON.STRINGIFY DE DADOS SENSÍVEIS (${issues.jsonStringify.length} problemas):`);
  issues.jsonStringify.forEach(issue => {
    console.log(`  ${issue.file}:${issue.line}`);
    console.log(`    ${issue.code}`);
  });
}

// localStorage
if (issues.localStorage.length > 0) {
  console.log(`\n🔴 DADOS SENSÍVEIS EM LOCALSTORAGE (${issues.localStorage.length} problemas):`);
  issues.localStorage.forEach(issue => {
    console.log(`  ${issue.file}:${issue.line}`);
    console.log(`    ${issue.code}`);
  });
}

// Exposed IDs
if (issues.exposedIds.length > 0) {
  console.log(`\n🟡 USER IDs EXPOSTOS (${issues.exposedIds.length} problemas):`);
  issues.exposedIds.slice(0, 10).forEach(issue => {
    console.log(`  ${issue.file}:${issue.line}`);
  });
}

// URL Params
if (issues.urlParams.length > 0) {
  console.log(`\n🟡 IDs EM URL PARAMS (${issues.urlParams.length} problemas):`);
  issues.urlParams.slice(0, 10).forEach(issue => {
    console.log(`  ${issue.file}:${issue.line}`);
  });
}

// Resumo
console.log('\n' + '='.repeat(80));
console.log('📋 RESUMO:');
console.log('='.repeat(80));
console.log(`🔴 Críticos (HIGH): ${issues.consoleLogs.filter(i => i.severity === 'HIGH').length + issues.reactKeys.length + issues.jsonStringify.length + issues.localStorage.length}`);
console.log(`🟡 Atenção (MEDIUM): ${issues.consoleLogs.filter(i => i.severity === 'MEDIUM').length + issues.exposedIds.length + issues.urlParams.length}`);
console.log();

// Salvar relatório em arquivo
const report = {
  timestamp: new Date().toISOString(),
  totalFiles: files.length,
  totalIssues,
  issues
};

fs.writeFileSync(
  path.join(process.cwd(), 'ANALISE_SEGURANCA_FRONTEND.json'),
  JSON.stringify(report, null, 2)
);

console.log('✅ Relatório salvo em: ANALISE_SEGURANCA_FRONTEND.json');























