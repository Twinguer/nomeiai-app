import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { devLog } from '@/utils/productionLogger';

// ✅ SEGURANÇA: Usar variáveis de ambiente em vez de valores hardcoded
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// ✅ SEGURANÇA CRÍTICA: Em produção, NUNCA usar fallbacks hardcoded
// Se as variáveis não estiverem configuradas, o sistema DEVE falhar imediatamente
if (!SUPABASE_URL) {
  const error = new Error('❌ CRÍTICO: VITE_SUPABASE_URL não configurada. Configure a variável de ambiente antes de usar em produção.');
  devLog.error(error.message);
  // Em produção, lançar erro imediatamente (sem fallback)
  if (import.meta.env.PROD) {
    throw error;
  }
  // Em desenvolvimento, apenas avisar (mas não usar fallback hardcoded)
  devLog.warn('⚠️ VITE_SUPABASE_URL não configurada. Configure no .env.local para desenvolvimento.');
}

if (!SUPABASE_ANON_KEY) {
  const error = new Error('❌ CRÍTICO: VITE_SUPABASE_ANON_KEY não configurada. Configure a variável de ambiente antes de usar em produção.');
  devLog.error(error.message);
  // Em produção, lançar erro imediatamente (sem fallback)
  if (import.meta.env.PROD) {
    throw error;
  }
  // Em desenvolvimento, apenas avisar (mas não usar fallback hardcoded)
  devLog.warn('⚠️ VITE_SUPABASE_ANON_KEY não configurada. Configure no .env.local para desenvolvimento.');
}

// The target is validated before each named build (PRD or HML), rather than
// hard-coding a hosted Supabase project identifier in the client.

// Validação final antes de criar o cliente
// Em produção, DEVE ter ambas as variáveis configuradas
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  const error = new Error('❌ CRÍTICO: Não foi possível inicializar o cliente Supabase. Verifique as variáveis de ambiente VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.');
  devLog.error(error.message, { 
    hasUrl: !!SUPABASE_URL, 
    hasKey: !!SUPABASE_ANON_KEY,
    isDev: import.meta.env.DEV,
    isProd: import.meta.env.PROD
  });
  // Em produção, lançar erro imediatamente (sem fallback)
  if (import.meta.env.PROD) {
    throw error;
  }
  // Em desenvolvimento, lançar erro também para forçar configuração
  throw error;
}

// ✅ DEBUG: Log de inicialização (apenas em desenvolvimento)
// ✅ SEGURANÇA: Não logar dados sensíveis mesmo em desenvolvimento
if (import.meta.env.DEV && import.meta.env.VITE_ENABLE_DEBUG_LOGS !== 'false') {
  devLog.info('Inicializando cliente Supabase', {
    url_configured: !!SUPABASE_URL,
    key_configured: !!SUPABASE_ANON_KEY,
    // Não incluir valores reais mesmo truncados
  });
} else if (import.meta.env.DEV) {
  // Em desenvolvimento mas com logs desabilitados, não logar nada
}

export const supabase = createClient<Database>(
  SUPABASE_URL!,
  SUPABASE_ANON_KEY!,
  {
    auth: {
      storage: localStorage,
      persistSession: true,
      autoRefreshToken: true,
    }
  }
);

// Export from other files to maintain backward compatibility
export * from './rankings';
export * from './community';
