/**
 * Configurações de ambiente seguras para o navegador
 * Evita problemas com process.env no frontend
 */

interface EnvironmentConfig {
  redis: {
    host: string;
    port: number;
    password?: string;
    db: number;
  };
  api: {
    url: string;
  };
  nodeEnv: string;
}

// Função segura para acessar variáveis de ambiente
function getEnvVar(key: string, defaultValue: string = ''): string {
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key] || defaultValue;
  }
  return defaultValue;
}

// Configuração do ambiente
export const environment: EnvironmentConfig = {
  redis: {
    host: getEnvVar('REACT_APP_REDIS_HOST', 'localhost'),
    port: parseInt(getEnvVar('REACT_APP_REDIS_PORT', '6379')),
    password: getEnvVar('REACT_APP_REDIS_PASSWORD') || undefined,
    db: parseInt(getEnvVar('REACT_APP_REDIS_DB', '0'))
  },
  api: {
    url: getEnvVar('REACT_APP_API_URL', 'http://localhost:3000')
  },
  nodeEnv: getEnvVar('NODE_ENV', 'development')
};

// Verificar se está em desenvolvimento
export const isDevelopment = environment.nodeEnv === 'development';

// Verificar se está em produção
export const isProduction = environment.nodeEnv === 'production';
