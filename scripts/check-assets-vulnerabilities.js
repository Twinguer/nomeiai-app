#!/usr/bin/env node

/**
 * Script para verificar vulnerabilidades em arquivos compilados na pasta assets
 * Verifica: chaves expostas, tokens, credenciais, URLs sensíveis, etc.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Padrões suspeitos para buscar
const SUSPICIOUS_PATTERNS = [
  // JWT tokens (começam com eyJ)
  { pattern: /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/g, name: 'JWT Token' },
  
  // Supabase service keys (começam com eyJ e são longos)
  { pattern: /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_-]{100,}/g, name: 'Supabase Service Key' },
  
  // URLs do Supabase com possíveis credenciais
  { pattern: /https:\/\/[a-z0-9]+\.supabase\.co/g, name: 'Supabase URL' },
  
  // Chaves de API comuns
  { pattern: /["'](?:api[_-]?key|apikey|access[_-]?token|secret[_-]?key|private[_-]?key)["']\s*[:=]\s*["']([^"']{20,})["']/gi, name: 'API Key Pattern' },
  
  // Service role keys
  { pattern: /service[_-]?role[_-]?key/gi, name: 'Service Role Key Reference' },
  
  // Senhas hardcoded
  { pattern: /["'](?:password|passwd|pwd)["']\s*[:=]\s*["']([^"']{8,})["']/gi, name: 'Hardcoded Password' },
  
  // Chaves de ofuscação antigas
  { pattern: /["'](?:obfuscation[_-]?key|OBFUSCATION_KEY)["']\s*[:=]\s*["']([^"']{16,})["']/gi, name: 'Obfuscation Key' },
  
  // Tokens de acesso
  { pattern: /["'](?:access[_-]?token|auth[_-]?token|bearer[_-]?token)["']\s*[:=]\s*["']([^"']{20,})["']/gi, name: 'Access Token' },
  
  // Variáveis de ambiente sensíveis
  { pattern: /process\.env\.(?:SECRET|KEY|PASSWORD|TOKEN|CREDENTIAL)/gi, name: 'Sensitive Environment Variable' },
  
  // Base64 encoded secrets (strings longas em base64)
  { pattern: /["']([A-Za-z0-9+/]{50,}={0,2})["']/g, name: 'Possible Base64 Secret', check: (match) => {
    try {
      const decoded = Buffer.from(match, 'base64').toString('utf-8');
      // Se decodificar e parecer com JSON ou texto sensível
      if (decoded.length > 20 && (decoded.includes('key') || decoded.includes('secret') || decoded.includes('token'))) {
        return true;
      }
    } catch (e) {}
    return false;
  }},
];

// Extensões de arquivo para verificar
const FILE_EXTENSIONS = ['.js', '.mjs', '.cjs', '.ts', '.jsx', '.tsx'];

function findAssetsDirectory() {
  const possibleDirs = ['dist', 'build', 'out', '.next'];
  const baseDir = process.cwd() || __dirname;
  
  for (const dir of possibleDirs) {
    const distPath = path.join(baseDir, dir);
    if (fs.existsSync(distPath)) {
      const assetsPath = path.join(distPath, 'assets');
      if (fs.existsSync(assetsPath)) {
        return assetsPath;
      }
    }
  }
  
  // Tentar encontrar qualquer pasta assets
  const assetsPath = path.join(baseDir, 'assets');
  if (fs.existsSync(assetsPath)) {
    return assetsPath;
  }
  
  return null;
}

function getAllFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      getAllFiles(filePath, fileList);
    } else {
      const ext = path.extname(file);
      if (FILE_EXTENSIONS.includes(ext)) {
        fileList.push(filePath);
      }
    }
  });
  
  return fileList;
}

function checkFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const issues = [];
  
  SUSPICIOUS_PATTERNS.forEach(({ pattern, name, check }) => {
    const matches = content.matchAll(pattern);
    
    for (const match of matches) {
      const fullMatch = match[0];
      const lineNumber = content.substring(0, match.index).split('\n').length;
      
      // Se houver função de verificação adicional
      if (check && !check(fullMatch)) {
        continue;
      }
      
      // Mascarar parte do valor para não expor completamente
      const masked = fullMatch.length > 50 
        ? fullMatch.substring(0, 20) + '...' + fullMatch.substring(fullMatch.length - 10)
        : fullMatch.substring(0, 10) + '***';
      
      issues.push({
        type: name,
        line: lineNumber,
        match: masked,
        severity: getSeverity(name),
      });
    }
  });
  
  return issues;
}

function getSeverity(issueType) {
  const high = ['JWT Token', 'Supabase Service Key', 'Service Role Key Reference', 'Hardcoded Password', 'Obfuscation Key'];
  const medium = ['API Key Pattern', 'Access Token', 'Sensitive Environment Variable'];
  
  if (high.includes(issueType)) return 'HIGH';
  if (medium.includes(issueType)) return 'MEDIUM';
  return 'LOW';
}

function main() {
  console.log('🔍 Verificando vulnerabilidades em arquivos assets...\n');
  
  const assetsDir = findAssetsDirectory();
  
  if (!assetsDir) {
    console.log('❌ Pasta assets não encontrada.');
    console.log('   Procurando em: dist/assets, build/assets, assets/');
    console.log('\n💡 Dica: Execute este script após fazer o build do projeto.');
    process.exit(1);
  }
  
  console.log(`📁 Verificando: ${assetsDir}\n`);
  
  const files = getAllFiles(assetsDir);
  console.log(`📄 Encontrados ${files.length} arquivos para verificar\n`);
  
  const allIssues = [];
  
  files.forEach(file => {
    const issues = checkFile(file);
    if (issues.length > 0) {
      allIssues.push({
        file: path.relative(process.cwd(), file),
        issues: issues,
      });
    }
  });
  
  // Relatório
  console.log('='.repeat(80));
  console.log('RELATÓRIO DE VULNERABILIDADES');
  console.log('='.repeat(80));
  console.log();
  
  if (allIssues.length === 0) {
    console.log('✅ Nenhuma vulnerabilidade encontrada!');
    console.log('   Os arquivos compilados parecem estar seguros.');
  } else {
    console.log(`⚠️  Encontradas ${allIssues.length} arquivo(s) com possíveis vulnerabilidades:\n`);
    
    // Agrupar por severidade
    const bySeverity = { HIGH: [], MEDIUM: [], LOW: [] };
    
    allIssues.forEach(({ file, issues }) => {
      issues.forEach(issue => {
        if (!bySeverity[issue.severity]) bySeverity[issue.severity] = [];
        bySeverity[issue.severity].push({ file, ...issue });
      });
    });
    
    // Mostrar por ordem de severidade
    ['HIGH', 'MEDIUM', 'LOW'].forEach(severity => {
      if (bySeverity[severity].length > 0) {
        console.log(`\n🔴 ${severity} SEVERITY (${bySeverity[severity].length} encontrada(s)):`);
        console.log('-'.repeat(80));
        
        bySeverity[severity].forEach(({ file, type, line, match }) => {
          console.log(`\n📄 ${file}`);
          console.log(`   Tipo: ${type}`);
          console.log(`   Linha: ${line}`);
          console.log(`   Match: ${match}`);
        });
      }
    });
    
    console.log('\n' + '='.repeat(80));
    console.log('\n⚠️  ATENÇÃO: Revise cuidadosamente os itens acima.');
    console.log('   Alguns podem ser falsos positivos, mas é importante verificar cada um.');
  }
  
  console.log();
}

// Executar se for o módulo principal
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('check-assets-vulnerabilities.js')) {
  main();
}

export { checkFile, findAssetsDirectory };

