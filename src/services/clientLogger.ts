interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  context?: string;
  data?: any;
  userId?: string;
  url?: string;
  userAgent?: string;
}

class ClientLogger {
  private maxLogs: number = 100;
  private logs: LogEntry[] = [];
  private isEnabled: boolean = process.env.NODE_ENV === 'development';

  private createLogEntry(level: LogEntry['level'], message: string, context?: string, data?: any, userId?: string): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      data: data ? JSON.stringify(data) : undefined,
      userId,
      url: window.location.href,
      userAgent: navigator.userAgent
    };
  }

  private addLog(entry: LogEntry): void {
    if (!this.isEnabled) return;

    this.logs.push(entry);
    
    // Keep only the last maxLogs entries
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Send to server in production
    if (process.env.NODE_ENV === 'production' && entry.level === 'error') {
      this.sendToServer(entry);
    }
  }

  private async sendToServer(entry: LogEntry): Promise<void> {
    try {
      // In a real implementation, you would send this to your logging endpoint
      // For now, we'll just store it locally
      console.log('Sending log to server:', entry);
    } catch (error) {
      console.error('Failed to send log to server:', error);
    }
  }

  info(message: string, context?: string, data?: any, userId?: string): void {
    const entry = this.createLogEntry('info', message, context, data, userId);
    this.addLog(entry);
    console.log(`[CLIENT INFO] ${message}`, data ? data : '');
  }

  warn(message: string, context?: string, data?: any, userId?: string): void {
    const entry = this.createLogEntry('warn', message, context, data, userId);
    this.addLog(entry);
    console.warn(`[CLIENT WARN] ${message}`, data ? data : '');
  }

  error(message: string, context?: string, data?: any, userId?: string): void {
    const entry = this.createLogEntry('error', message, context, data, userId);
    this.addLog(entry);
    console.error(`[CLIENT ERROR] ${message}`, data ? data : '');
  }

  debug(message: string, context?: string, data?: any, userId?: string): void {
    const entry = this.createLogEntry('debug', message, context, data, userId);
    this.addLog(entry);
    console.log(`[CLIENT DEBUG] ${message}`, data ? data : '');
  }

  // API logs
  api(message: string, context?: string, data?: any, userId?: string): void {
    const entry = this.createLogEntry('info', message, context, data, userId);
    this.addLog(entry);
    console.log(`[CLIENT API] ${message}`, data ? data : '');
  }

  // User action logs
  userAction(action: string, context?: string, data?: any, userId?: string): void {
    const entry = this.createLogEntry('info', `User action: ${action}`, context, data, userId);
    this.addLog(entry);
    console.log(`[CLIENT USER ACTION] ${action}`, data ? data : '');
  }

  // Performance logs
  performance(message: string, context?: string, data?: any, userId?: string): void {
    const entry = this.createLogEntry('info', message, context, data, userId);
    this.addLog(entry);
    console.log(`[CLIENT PERFORMANCE] ${message}`, data ? data : '');
  }

  // Get all logs
  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  // Clear logs
  clearLogs(): void {
    this.logs = [];
  }

  // Export logs as JSON
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  // Download logs as file
  downloadLogs(): void {
    const logsJson = this.exportLogs();
    const blob = new Blob([logsJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `client-logs-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

// Export singleton instance
export const clientLogger = new ClientLogger();
export default clientLogger;
