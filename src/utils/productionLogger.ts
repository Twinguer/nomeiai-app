/**
 * Production Logger
 * Logger seguro para produção que não expõe dados sensíveis
 */

const IS_PRODUCTION = import.meta.env.PROD;
// ✅ SEGURANÇA: Flag para desabilitar logs mesmo em desenvolvimento
const ENABLE_DEBUG_LOGS = import.meta.env.VITE_ENABLE_DEBUG_LOGS !== 'false';

/**
 * Logger que só funciona em desenvolvimento
 * Em produção, apenas erros críticos são logados
 */
export const devLog = {
  info: (...args: any[]) => {
    if (!IS_PRODUCTION && ENABLE_DEBUG_LOGS) {
      console.log('[DEV]', ...args.map(arg => sanitizeForLog(arg)));
    }
  },
  
  warn: (...args: any[]) => {
    if (!IS_PRODUCTION && ENABLE_DEBUG_LOGS) {
      console.warn('[DEV]', ...args.map(arg => sanitizeForLog(arg)));
    }
  },
  
  error: (...args: any[]) => {
    // Erros sempre são logados, mas sanitizados
    console.error('[ERROR]', ...args.map(arg => sanitizeForLog(arg)));
  },
  
  debug: (...args: any[]) => {
    if (!IS_PRODUCTION && ENABLE_DEBUG_LOGS) {
      console.debug('[DEBUG]', ...args.map(arg => sanitizeForLog(arg)));
    }
  },
  
  // Métodos de compatibilidade para substituir console.log diretamente
  log: (...args: any[]) => {
    if (!IS_PRODUCTION && ENABLE_DEBUG_LOGS) {
      console.log('[DEV]', ...args.map(arg => sanitizeForLog(arg)));
    }
  }
};

/**
 * Sanitiza dados sensíveis antes de logar
 */
export const sanitizeForLog = (data: any): any => {
  if (!data || typeof data !== 'object') {
    // Sanitizar strings que podem conter dados sensíveis
    if (typeof data === 'string') {
      // Verificar se é uma chave JWT ou URL do Supabase
      if (data.length > 50 && (data.startsWith('eyJ') || data.includes('supabase.co'))) {
        return '[REDACTED_SENSITIVE_STRING]';
      }
      // Verificar se contém chaves ou tokens
      if (data.includes('key') || data.includes('token') || data.includes('secret')) {
        return '[REDACTED_SENSITIVE_STRING]';
      }
    }
    return data;
  }

  const sensitiveKeys = [
    'password', 'token', 'email', 'cpf', 'phone', 'api_key', 
    'access_token', 'refresh_token', 'anon_key', 'service_key',
    'key', 'secret', 'credential', 'auth', 'authorization'
  ];
  const sanitized = { ...data };

  for (const key in sanitized) {
    const lowerKey = key.toLowerCase();
    const value = sanitized[key];
    
    // Não sanitizar valores booleanos, números ou null
    if (typeof value === 'boolean' || typeof value === 'number' || value === null) {
      // Manter o valor original
      continue;
    }
    
    // Verificar se a chave é sensível E o valor não é booleano/número
    if (sensitiveKeys.some(sensitive => lowerKey.includes(sensitive))) {
      // Se for string, verificar se realmente contém dados sensíveis
      if (typeof value === 'string' && value.length > 10) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value !== 'string') {
        // Para não-strings, apenas marcar como redacted se for objeto complexo
        sanitized[key] = '[REDACTED]';
      }
    } 
    // Verificar se o valor é uma string sensível (JWT, URLs do Supabase, etc)
    else if (typeof value === 'string') {
      if (value.length > 50 && (value.startsWith('eyJ') || value.includes('supabase.co'))) {
        sanitized[key] = '[REDACTED_SENSITIVE_STRING]';
      } else if (value.length > 20 && (value.includes('key') || value.includes('token') || value.includes('secret'))) {
        sanitized[key] = '[REDACTED_SENSITIVE_STRING]';
      }
    } 
    // Recursão para objetos aninhados
    else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeForLog(value);
    }
  }

  return sanitized;
};
