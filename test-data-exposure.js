/**
 * Script de teste para verificar exposição de dados sensíveis no frontend
 * Execute no console do navegador após carregar a aplicação
 */

(function() {
  console.log('🔍 Iniciando análise de exposição de dados sensíveis...\n');
  
  const findings = {
    localStorage: [],
    sessionStorage: [],
    cookies: [],
    windowVars: [],
    networkRequests: [],
    consoleLogs: []
  };

  // 1. Verificar localStorage
  console.log('📦 Verificando localStorage...');
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    const value = localStorage.getItem(key);
    
    // Verificar se contém dados sensíveis
    const sensitivePatterns = [
      /password/i,
      /token/i,
      /secret/i,
      /key/i,
      /auth/i,
      /credential/i,
      /email/i,
      /cpf/i,
      /rg/i,
      /phone/i,
      /telefone/i
    ];
    
    const isSensitive = sensitivePatterns.some(pattern => 
      pattern.test(key) || pattern.test(value)
    );
    
    if (isSensitive) {
      findings.localStorage.push({
        key,
        value: value.length > 100 ? value.substring(0, 100) + '...' : value,
        risk: 'HIGH'
      });
    } else if (value && value.length > 0) {
      findings.localStorage.push({
        key,
        value: value.length > 50 ? value.substring(0, 50) + '...' : value,
        risk: 'LOW'
      });
    }
  }

  // 2. Verificar sessionStorage
  console.log('📦 Verificando sessionStorage...');
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    const value = sessionStorage.getItem(key);
    
    const sensitivePatterns = [
      /password/i,
      /token/i,
      /secret/i,
      /key/i,
      /auth/i
    ];
    
    const isSensitive = sensitivePatterns.some(pattern => 
      pattern.test(key) || pattern.test(value)
    );
    
    if (isSensitive) {
      findings.sessionStorage.push({
        key,
        value: value.length > 100 ? value.substring(0, 100) + '...' : value,
        risk: 'HIGH'
      });
    }
  }

  // 3. Verificar cookies
  console.log('🍪 Verificando cookies...');
  document.cookie.split(';').forEach(cookie => {
    const [key, value] = cookie.trim().split('=');
    if (key && value) {
      const sensitivePatterns = [/token/i, /auth/i, /session/i, /secret/i];
      const isSensitive = sensitivePatterns.some(pattern => 
        pattern.test(key) || pattern.test(value)
      );
      
      if (isSensitive) {
        findings.cookies.push({
          key,
          value: value.length > 50 ? value.substring(0, 50) + '...' : value,
          risk: 'HIGH'
        });
      }
    }
  });

  // 4. Verificar variáveis globais do window
  console.log('🌐 Verificando variáveis globais...');
  const globalVars = ['supabase', 'VITE_', 'API_', 'SECRET', 'KEY', 'TOKEN'];
  globalVars.forEach(varName => {
    if (window[varName] !== undefined) {
      findings.windowVars.push({
        name: varName,
        type: typeof window[varName],
        risk: 'MEDIUM'
      });
    }
  });

  // 5. Interceptar requisições de rede
  console.log('🌐 Interceptando requisições de rede...');
  const originalFetch = window.fetch;
  window.fetch = function(...args) {
    const url = args[0];
    const options = args[1] || {};
    
    // Verificar se há dados sensíveis no body
    if (options.body) {
      const bodyStr = typeof options.body === 'string' 
        ? options.body 
        : JSON.stringify(options.body);
      
      const sensitivePatterns = [
        /password/i,
        /token/i,
        /secret/i,
        /cpf/i,
        /email/i
      ];
      
      const isSensitive = sensitivePatterns.some(pattern => pattern.test(bodyStr));
      
      if (isSensitive) {
        findings.networkRequests.push({
          url: typeof url === 'string' ? url : url.toString(),
          method: options.method || 'GET',
          hasSensitiveData: true,
          risk: 'HIGH'
        });
      }
    }
    
    return originalFetch.apply(this, args);
  };

  // 6. Interceptar console.log para detectar dados sensíveis
  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;
  const originalConsoleWarn = console.warn;
  
  console.log = function(...args) {
    const message = args.join(' ');
    const sensitivePatterns = [
      /password/i,
      /token/i,
      /secret/i,
      /cpf/i,
      /email.*@/i
    ];
    
    if (sensitivePatterns.some(pattern => pattern.test(message))) {
      findings.consoleLogs.push({
        type: 'log',
        message: message.substring(0, 200),
        risk: 'HIGH'
      });
    }
    
    return originalConsoleLog.apply(this, args);
  };

  // Gerar relatório
  setTimeout(() => {
    console.log('\n\n📊 RELATÓRIO DE ANÁLISE DE DADOS SENSÍVEIS\n');
    console.log('='.repeat(60));
    
    // localStorage
    console.log('\n📦 LOCALSTORAGE:');
    if (findings.localStorage.length === 0) {
      console.log('  ✅ Nenhum dado sensível encontrado');
    } else {
      findings.localStorage.forEach(item => {
        console.log(`  ${item.risk === 'HIGH' ? '🔴' : '🟡'} ${item.key}: ${item.value}`);
      });
    }
    
    // sessionStorage
    console.log('\n📦 SESSIONSTORAGE:');
    if (findings.sessionStorage.length === 0) {
      console.log('  ✅ Nenhum dado sensível encontrado');
    } else {
      findings.sessionStorage.forEach(item => {
        console.log(`  🔴 ${item.key}: ${item.value}`);
      });
    }
    
    // Cookies
    console.log('\n🍪 COOKIES:');
    if (findings.cookies.length === 0) {
      console.log('  ✅ Nenhum cookie sensível encontrado');
    } else {
      findings.cookies.forEach(item => {
        console.log(`  🔴 ${item.key}: ${item.value}`);
      });
    }
    
    // Variáveis globais
    console.log('\n🌐 VARIÁVEIS GLOBAIS:');
    if (findings.windowVars.length === 0) {
      console.log('  ✅ Nenhuma variável global sensível encontrada');
    } else {
      findings.windowVars.forEach(item => {
        console.log(`  🟡 ${item.name}: ${item.type}`);
      });
    }
    
    // Requisições de rede
    console.log('\n🌐 REQUISIÇÕES DE REDE:');
    if (findings.networkRequests.length === 0) {
      console.log('  ✅ Nenhuma requisição com dados sensíveis detectada');
    } else {
      findings.networkRequests.forEach(item => {
        console.log(`  🔴 ${item.method} ${item.url}`);
      });
    }
    
    // Console logs
    console.log('\n📝 CONSOLE LOGS:');
    if (findings.consoleLogs.length === 0) {
      console.log('  ✅ Nenhum log com dados sensíveis detectado');
    } else {
      findings.consoleLogs.forEach(item => {
        console.log(`  🔴 [${item.type}] ${item.message}`);
      });
    }
    
    // Resumo
    const highRiskCount = 
      findings.localStorage.filter(f => f.risk === 'HIGH').length +
      findings.sessionStorage.length +
      findings.cookies.length +
      findings.networkRequests.length +
      findings.consoleLogs.length;
    
    console.log('\n' + '='.repeat(60));
    console.log(`\n📊 RESUMO:`);
    console.log(`  🔴 Alto Risco: ${highRiskCount}`);
    console.log(`  🟡 Médio Risco: ${findings.windowVars.length}`);
    console.log(`  ✅ Total de itens verificados: ${Object.values(findings).flat().length}`);
    
    if (highRiskCount === 0) {
      console.log('\n  ✅ Nenhum dado sensível crítico encontrado!');
    } else {
      console.log(`\n  ⚠️  ${highRiskCount} item(ns) de alto risco encontrado(s)!`);
    }
    
    console.log('\n' + '='.repeat(60));
    
    // Retornar objeto com findings para uso programático
    return findings;
  }, 2000);
  
  return findings;
})();

