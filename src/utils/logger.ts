/**
 * Logger simples e funcional
 * Sistema leve para desenvolvimento e produção
 */

import { isDevelopment, isProduction } from '@/config/environment';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class Logger {
  private isDevelopment = isDevelopment;
  private isProduction = isProduction;

  private shouldLog(level: LogLevel): boolean {
    // Em desenvolvimento: log tudo
    if (this.isDevelopment) return true;

    // Em produção: apenas warn e error
    if (this.isProduction) {
      return level === 'warn' || level === 'error';
    }

    return true;
  }

  private log(level: LogLevel, message: string, context?: string, data?: any): void {
    if (!this.shouldLog(level)) return;

    const timestamp = new Date().toISOString();
    const contextStr = context ? `[${context}]` : '';
    const formattedMessage = `[${level.toUpperCase()}] ${timestamp} ${contextStr} ${message}`;

    // Converter dados para string de forma segura
    let safeData = '';
    if (data) {
      try {
        safeData = typeof data === 'object' ? JSON.stringify(data, null, 2) : String(data);
      } catch (error) {
        safeData = '[Error converting data to string]';
      }
    }

    switch (level) {
      case 'debug':
        // console.log(formattedMessage, safeData);
        break;
      case 'info':
        // console.info(formattedMessage, safeData);
        break;
      case 'warn':
        console.warn(formattedMessage, safeData);
        break;
      case 'error':
        console.error(formattedMessage, safeData);
        break;
    }
  }

  debug(message: string, context?: string, data?: any): void {
    this.log('debug', message, context, data);
  }

  info(message: string, context?: string, data?: any): void {
    this.log('info', message, context, data);
  }

  warn(message: string, context?: string, data?: any): void {
    this.log('warn', message, context, data);
  }

  error(message: string, context?: string, data?: any): void {
    this.log('error', message, context, data);
  }

  // Método para logging de performance
  performance(operation: string, duration: number, context?: string): void {
    const message = `${operation} completed in ${duration.toFixed(2)}ms`;
    this.info(message, context || 'PERFORMANCE');
  }

  // Método para logging de ranking específico
  ranking(message: string, data?: any): void {
    this.debug(message, 'RANKING', data);
  }

  // Método para logging de answer sheet específico
  answerSheet(message: string, data?: any): void {
    this.debug(message, 'ANSWER_SHEET', data);
  }
}

// Instância singleton do logger
export const logger = new Logger();

// Exportar métodos individuais para compatibilidade
export const { debug, info, warn, error, performance, ranking, answerSheet } = logger;