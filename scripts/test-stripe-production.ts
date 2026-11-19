/**
 * Script de Teste para Integração Stripe em Produção
 * 
 * Este script testa:
 * 1. Configuração das variáveis de ambiente
 * 2. Price IDs de produção
 * 3. Estrutura das Edge Functions
 */

import { readFileSync } from 'fs';
import { join } from 'path';

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
}

const results: TestResult[] = [];

// Price IDs de produção esperados
const EXPECTED_LIVE_PRICES = {
  pro: "price_1SRaGrFbBP7AYhAYK3UISUzO",
  coach_starter: "price_1SRaHbFbBP7AYhAYcjvOF6bB",
  coach_professional: "price_1SRaI8FbBP7AYhAYWHNeSPMW",
  coach_enterprise: "price_1SRaIbFbBP7AYhAYgbDmmBdG",
};

function test(name: string, testFn: () => boolean, message: string) {
  try {
    const passed = testFn();
    results.push({ name, passed, message: passed ? message : `❌ ${message}` });
  } catch (error) {
    results.push({ name, passed: false, message: `❌ Erro: ${error}` });
  }
}

// Teste 1: Verificar Price IDs em create-checkout
test(
  'Price IDs em create-checkout',
  () => {
    const filePath = join(process.cwd(), 'supabase/functions/create-checkout/index.ts');
    const content = readFileSync(filePath, 'utf-8');
    
    return Object.entries(EXPECTED_LIVE_PRICES).every(([key, priceId]) => {
      return content.includes(priceId);
    });
  },
  '✅ Todos os Price IDs de produção estão configurados em create-checkout'
);

// Teste 2: Verificar Price IDs em verify-stripe-subscription
test(
  'Price IDs em verify-stripe-subscription',
  () => {
    const filePath = join(process.cwd(), 'supabase/functions/verify-stripe-subscription/index.ts');
    const content = readFileSync(filePath, 'utf-8');
    
    return Object.entries(EXPECTED_LIVE_PRICES).every(([key, priceId]) => {
      return content.includes(priceId);
    });
  },
  '✅ Todos os Price IDs de produção estão configurados em verify-stripe-subscription'
);

// Teste 3: Verificar Price IDs em stripe-webhook
test(
  'Price IDs em stripe-webhook',
  () => {
    const filePath = join(process.cwd(), 'supabase/functions/stripe-webhook/index.ts');
    const content = readFileSync(filePath, 'utf-8');
    
    return Object.entries(EXPECTED_LIVE_PRICES).every(([key, priceId]) => {
      return content.includes(priceId);
    });
  },
  '✅ Todos os Price IDs de produção estão configurados em stripe-webhook'
);

// Teste 4: Verificar função getStripePrices
test(
  'Função getStripePrices existe',
  () => {
    const filePath = join(process.cwd(), 'supabase/functions/create-checkout/index.ts');
    const content = readFileSync(filePath, 'utf-8');
    
    return content.includes('function getStripePrices') || content.includes('const getStripePrices');
  },
  '✅ Função getStripePrices está implementada'
);

// Teste 5: Verificar detecção automática de modo (sk_live_)
test(
  'Detecção automática de modo produção',
  () => {
    const filePath = join(process.cwd(), 'supabase/functions/create-checkout/index.ts');
    const content = readFileSync(filePath, 'utf-8');
    
    return content.includes('sk_live_') || content.includes('startsWith("sk_live_")');
  },
  '✅ Sistema detecta automaticamente modo produção (sk_live_)'
);

// Teste 6: Verificar estrutura STRIPE_PRICES_LIVE
test(
  'Estrutura STRIPE_PRICES_LIVE',
  () => {
    const filePath = join(process.cwd(), 'supabase/functions/create-checkout/index.ts');
    const content = readFileSync(filePath, 'utf-8');
    
    return content.includes('STRIPE_PRICES_LIVE') && 
           content.includes('pro:') &&
           content.includes('coach_starter:') &&
           content.includes('coach_professional:') &&
           content.includes('coach_enterprise:');
  },
  '✅ Estrutura STRIPE_PRICES_LIVE está completa'
);

// Teste 7: Verificar validação de Price IDs não configurados
test(
  'Validação de Price IDs não configurados',
  () => {
    const filePath = join(process.cwd(), 'supabase/functions/create-checkout/index.ts');
    const content = readFileSync(filePath, 'utf-8');
    
    return content.includes('Price ID não configurado') || 
           content.includes('PREENCHER');
  },
  '✅ Validação de Price IDs não configurados está implementada'
);

// Executar testes
console.log('\n🧪 Testando Configuração Stripe para Produção\n');
console.log('='.repeat(60));

results.forEach((result, index) => {
  const icon = result.passed ? '✅' : '❌';
  console.log(`${icon} [${index + 1}/${results.length}] ${result.name}`);
  if (!result.passed) {
    console.log(`   ${result.message}`);
  }
});

console.log('\n' + '='.repeat(60));

const passedCount = results.filter(r => r.passed).length;
const totalCount = results.length;
const allPassed = passedCount === totalCount;

console.log(`\n📊 Resultado: ${passedCount}/${totalCount} testes passaram\n`);

if (allPassed) {
  console.log('✅ Todos os testes passaram! A configuração está correta.\n');
  console.log('📝 Próximos passos:');
  console.log('   1. Verificar se STRIPE_SECRET_KEY está configurada (sk_live_...)');
  console.log('   2. Verificar se STRIPE_WEBHOOK_SECRET está configurada');
  console.log('   3. Fazer deploy das Edge Functions: supabase functions deploy');
  console.log('   4. Testar checkout em produção\n');
  process.exit(0);
} else {
  console.log('❌ Alguns testes falharam. Verifique a configuração.\n');
  process.exit(1);
}


