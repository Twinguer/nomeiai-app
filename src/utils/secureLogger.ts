/**
 * Secure Logger Utility
 * Provides safe logging that doesn't expose sensitive data in production
 */

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  data?: any;
  timestamp: number;
  context?: string;
}

class SecureLogger {
  private static instance: SecureLogger;
  private logLevel: LogLevel;
  private isProduction: boolean;

  private constructor() {
    this.isProduction = import.meta.env.PROD;
    this.logLevel = this.isProduction ? LogLevel.WARN : LogLevel.DEBUG;
  }

  public static getInstance(): SecureLogger {
    if (!SecureLogger.instance) {
      SecureLogger.instance = new SecureLogger();
    }
    return SecureLogger.instance;
  }

  /**
   * Sanitize data to remove sensitive information
   */
  private sanitizeData(data: any): any {
    if (!data || typeof data !== 'object') {
      return data;
    }

    const sensitiveKeys = [
      'password', 'token', 'key', 'secret', 'auth', 'credential',
      'email', 'phone', 'ssn', 'cpf', 'cnpj', 'credit_card',
      'bank_account', 'api_key', 'access_token', 'refresh_token',
      'anon_key', 'service_key', 'authorization', 'supabase'
    ];

    const sanitized = { ...data };

    for (const key in sanitized) {
      const lowerKey = key.toLowerCase();
      if (sensitiveKeys.some(sensitive => lowerKey.includes(sensitive))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof sanitized[key] === 'string') {
        const value = sanitized[key];
        // Verificar se é uma chave JWT ou URL do Supabase
        if (value.length > 50 && (value.startsWith('eyJ') || value.includes('supabase.co'))) {
          sanitized[key] = '[REDACTED_SENSITIVE_STRING]';
        } else if (value.includes('key') || value.includes('token') || value.includes('secret')) {
          sanitized[key] = '[REDACTED_SENSITIVE_STRING]';
        }
      } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
        sanitized[key] = this.sanitizeData(sanitized[key]);
      }
    }

    return sanitized;
  }

  /**
   * Format log entry for output
   */
  private formatLogEntry(entry: LogEntry): string {
    const timestamp = new Date(entry.timestamp).toISOString();
    const level = LogLevel[entry.level];
    const context = entry.context ? `[${entry.context}]` : '';
    const data = entry.data ? ` | Data: ${JSON.stringify(this.sanitizeData(entry.data))}` : '';
    
    return `${timestamp} ${level}${context}: ${entry.message}${data}`;
  }

  /**
   * Log a message
   */
  private log(level: LogLevel, message: string, data?: any, context?: string): void {
    if (level > this.logLevel) {
      return;
    }

    const entry: LogEntry = {
      level,
      message,
      data: this.sanitizeData(data),
      timestamp: Date.now(),
      context
    };

    const formattedMessage = this.formatLogEntry(entry);

    switch (level) {
      case LogLevel.ERROR:
        console.error(formattedMessage);
        break;
      case LogLevel.WARN:
        console.warn(formattedMessage);
        break;
      case LogLevel.INFO:
        console.info(formattedMessage);
        break;
      case LogLevel.DEBUG:
        console.debug(formattedMessage);
        break;
    }

    // In production, also send to external logging service if configured
    if (this.isProduction && level <= LogLevel.WARN) {
      this.sendToExternalLogger(entry);
    }
  }

  /**
   * Send critical logs to external service in production
   */
  private sendToExternalLogger(entry: LogEntry): void {
    // This would integrate with services like Sentry, LogRocket, etc.
    // For now, we'll just store in localStorage for debugging
    try {
      const logs = JSON.parse(localStorage.getItem('secure_logs') || '[]');
      logs.push(entry);
      
      // Keep only last 100 logs
      if (logs.length > 100) {
        logs.splice(0, logs.length - 100);
      }
      
      localStorage.setItem('secure_logs', JSON.stringify(logs));
    } catch (error) {
      // Silent fail - don't break the app for logging
    }
  }

  /**
   * Error logging
   */
  public error(message: string, data?: any, context?: string): void {
    this.log(LogLevel.ERROR, message, data, context);
  }

  /**
   * Warning logging
   */
  public warn(message: string, data?: any, context?: string): void {
    this.log(LogLevel.WARN, message, data, context);
  }

  /**
   * Info logging
   */
  public info(message: string, data?: any, context?: string): void {
    this.log(LogLevel.INFO, message, data, context);
  }

  /**
   * Debug logging (only in development)
   */
  public debug(message: string, data?: any, context?: string): void {
    this.log(LogLevel.DEBUG, message, data, context);
  }

  /**
   * Security event logging
   */
  public security(event: string, data?: any, context?: string): void {
    this.log(LogLevel.WARN, `SECURITY: ${event}`, data, context);
  }

  /**
   * Performance logging
   */
  public performance(operation: string, duration: number, data?: any): void {
    this.log(LogLevel.INFO, `PERFORMANCE: ${operation} took ${duration}ms`, data, 'PERFORMANCE');
  }

  /**
   * Get stored logs (for debugging)
   */
  public getStoredLogs(): LogEntry[] {
    try {
      return JSON.parse(localStorage.getItem('secure_logs') || '[]');
    } catch {
      return [];
    }
  }

  /**
   * Clear stored logs
   */
  public clearStoredLogs(): void {
    localStorage.removeItem('secure_logs');
  }
}

// Export singleton instance
export const logger = SecureLogger.getInstance();

// Export convenience functions
export const logError = (message: string, data?: any, context?: string) => 
  logger.error(message, data, context);

export const logWarn = (message: string, data?: any, context?: string) => 
  logger.warn(message, data, context);

export const logInfo = (message: string, data?: any, context?: string) => 
  logger.info(message, data, context);

export const logDebug = (message: string, data?: any, context?: string) => 
  logger.debug(message, data, context);

export const logSecurity = (event: string, data?: any, context?: string) => 
  logger.security(event, data, context);

export const logPerformance = (operation: string, duration: number, data?: any) => 
  logger.performance(operation, data);
