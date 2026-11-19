export interface LoggingConfig {
  server: {
    enabled: boolean;
    level: 'debug' | 'info' | 'warn' | 'error';
    maxFileSize: number; // in bytes
    maxFiles: number;
    categories: {
      server: boolean;
      client: boolean;
      errors: boolean;
      access: boolean;
      debug: boolean;
    };
  };
  client: {
    enabled: boolean;
    level: 'debug' | 'info' | 'warn' | 'error';
    maxLogs: number;
    sendToServer: boolean;
  };
  security: {
    logSensitiveData: boolean;
    redactFields: string[];
  };
}

export const loggingConfig: LoggingConfig = {
  server: {
    enabled: process.env.NODE_ENV === 'production' || process.env.ENABLE_LOGGING === 'true',
    level: (process.env.LOG_LEVEL as any) || 'info',
    maxFileSize: 10 * 1024 * 1024, // 10MB
    maxFiles: 5,
    categories: {
      server: true,
      client: true,
      errors: true,
      access: true,
      debug: process.env.NODE_ENV === 'development'
    }
  },
  client: {
    enabled: process.env.NODE_ENV === 'development' || process.env.ENABLE_CLIENT_LOGGING === 'true',
    level: (process.env.CLIENT_LOG_LEVEL as any) || 'warn',
    maxLogs: 100,
    sendToServer: process.env.NODE_ENV === 'production'
  },
  security: {
    logSensitiveData: false,
    redactFields: [
      'password',
      'token',
      'authorization',
      'secret',
      'key',
      'ssn',
      'creditCard',
      'cvv'
    ]
  }
};

export const isLoggingEnabled = (category: keyof LoggingConfig['server']['categories']): boolean => {
  return loggingConfig.server.enabled && loggingConfig.server.categories[category];
};

export const shouldLogLevel = (level: string, configLevel: string): boolean => {
  const levels = ['debug', 'info', 'warn', 'error'];
  const levelIndex = levels.indexOf(level);
  const configLevelIndex = levels.indexOf(configLevel);
  return levelIndex >= configLevelIndex;
};
