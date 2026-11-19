/**
 * Exemplo de uso do sistema de logging
 * Este arquivo demonstra como usar os diferentes tipos de logs
 */

import { serverLogger } from '../services/serverLogger';
import { clientLogger } from '../services/clientLogger';
import { devLog, sanitizeForLog } from '@/utils/productionLogger';

// Exemplo de uso no servidor
export const serverLoggingExample = () => {
  // Log informativo
  serverLogger.info(
    'User authentication successful',
    'AUTH',
    { userId: '123', email: 'user@example.com' },
    '123'
  );

  // Log de aviso
  serverLogger.warn(
    'High memory usage detected',
    'SYSTEM',
    { memoryUsage: '85%', threshold: '80%' }
  );

  // Log de erro
  serverLogger.error(
    'Database connection failed',
    'DATABASE',
    { error: 'Connection timeout', retries: 3 },
    '123'
  );

  // Log de debug
  serverLogger.debug(
    'Processing user request',
    'API',
    { endpoint: '/api/users', method: 'GET' },
    '123'
  );

  // Log de acesso
  serverLogger.access(
    'GET',
    '/api/users',
    200,
    150,
    '123',
    '192.168.1.1',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  );

  // Log de segurança
  serverLogger.security(
    'Failed login attempt',
    'AUTH',
    { email: 'user@example.com', ip: '192.168.1.1' },
    undefined,
    '192.168.1.1',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  );

  // Log de banco de dados
  serverLogger.database(
    'Query executed successfully',
    'DATABASE',
    { query: 'SELECT * FROM users', executionTime: 45 },
    '123'
  );

  // Log de API
  serverLogger.api(
    'External API call completed',
    'EXTERNAL_API',
    { url: 'https://api.example.com/users', status: 200 },
    '123',
    '192.168.1.1'
  );
};

// Exemplo de uso no cliente
export const clientLoggingExample = () => {
  // Log informativo
  clientLogger.info(
    'Component mounted successfully',
    'REACT_COMPONENT',
    { componentName: 'UserProfile' }
  );

  // Log de aviso
  clientLogger.warn(
    'Slow network connection detected',
    'NETWORK',
    { responseTime: 5000, threshold: 3000 }
  );

  // Log de erro
  clientLogger.error(
    'API request failed',
    'API',
    { url: '/api/users', status: 500, error: 'Internal Server Error' },
    '123'
  );

  // Log de debug
  clientLogger.debug(
    'State updated',
    'REACT_STATE',
    { component: 'UserProfile', newState: { loading: false } }
  );

  // Log de API
  clientLogger.api(
    'API request initiated',
    'API',
    { url: '/api/users', method: 'GET' },
    '123'
  );

  // Log de ação do usuário
  clientLogger.userAction(
    'Button clicked',
    'UI_INTERACTION',
    { buttonId: 'submit-form', formId: 'user-form' },
    '123'
  );

  // Log de performance
  clientLogger.performance(
    'Page load completed',
    'PERFORMANCE',
    { loadTime: 1200, resources: 15 },
    '123'
  );
};

// Exemplo de integração com React
export const reactLoggingExample = () => {
  // Em um componente React
  const handleUserAction = (action: string, data?: any) => {
    clientLogger.userAction(action, 'REACT_COMPONENT', data);
  };

  const handleError = (error: Error, context?: string) => {
    clientLogger.error(
      error.message,
      context || 'REACT_COMPONENT',
      { stack: error.stack, name: error.name }
    );
  };

  const handleApiCall = (url: string, method: string) => {
    clientLogger.api(`API call: ${method} ${url}`, 'API', { url, method });
  };

  return {
    handleUserAction,
    handleError,
    handleApiCall
  };
};

// Exemplo de integração com Supabase
export const supabaseLoggingExample = () => {
  // Log de autenticação
  const logAuthEvent = (event: string, userId?: string, data?: any) => {
    serverLogger.info(
      `Auth event: ${event}`,
      'SUPABASE_AUTH',
      data,
      userId
    );
  };

  // Log de operação de banco
  const logDatabaseOperation = (operation: string, table: string, data?: any) => {
    serverLogger.database(
      `Database operation: ${operation} on ${table}`,
      'SUPABASE_DB',
      data
    );
  };

  // Log de erro do Supabase
  const logSupabaseError = (error: any, context: string) => {
    serverLogger.error(
      `Supabase error: ${error.message}`,
      context,
      { error: error.message, code: error.code }
    );
  };

  return {
    logAuthEvent,
    logDatabaseOperation,
    logSupabaseError
  };
};

// Exemplo de configuração de logging
export const configureLogging = () => {
  // Configurar níveis de log baseados no ambiente
  const isDevelopment = process.env.NODE_ENV === 'development';
  const isProduction = process.env.NODE_ENV === 'production';

  if (isDevelopment) {
    // Em desenvolvimento, log tudo
    devLog.log('Logging configured for development');
  } else if (isProduction) {
    // Em produção, apenas logs importantes
    devLog.log('Logging configured for production');
  }

  // Configurar redirecionamento de erros não capturados
  if (typeof window !== 'undefined') {
    window.addEventListener('error', (event) => {
      clientLogger.error(
        'Uncaught error',
        'GLOBAL_ERROR',
        {
          message: event.message,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          error: event.error
        }
      );
    });

    window.addEventListener('unhandledrejection', (event) => {
      clientLogger.error(
        'Unhandled promise rejection',
        'GLOBAL_ERROR',
        {
          reason: event.reason,
          promise: event.promise
        }
      );
    });
  }
};
