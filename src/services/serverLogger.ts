import fs from 'fs';
import path from 'path';

interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  context?: string;
  data?: any;
  userId?: string;
  ip?: string;
  userAgent?: string;
}

class ServerLogger {
  private logDir: string;
  private maxFileSize: number = 10 * 1024 * 1024; // 10MB
  private maxFiles: number = 5;

  constructor() {
    this.logDir = path.join(process.cwd(), 'logs');
    this.ensureLogDirectories();
  }

  private ensureLogDirectories(): void {
    const directories = ['server', 'client', 'errors', 'access', 'debug'];
    
    directories.forEach(dir => {
      const dirPath = path.join(this.logDir, dir);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
    });
  }

  private getLogFileName(category: string, level: string): string {
    const date = new Date().toISOString().split('T')[0];
    return path.join(this.logDir, category, `${level}-${date}.log`);
  }

  private rotateLogFile(filePath: string): void {
    if (!fs.existsSync(filePath)) return;

    const stats = fs.statSync(filePath);
    if (stats.size < this.maxFileSize) return;

    // Rotate files
    for (let i = this.maxFiles - 1; i > 0; i--) {
      const oldFile = `${filePath}.${i}`;
      const newFile = `${filePath}.${i + 1}`;
      
      if (fs.existsSync(oldFile)) {
        if (i === this.maxFiles - 1) {
          fs.unlinkSync(oldFile);
        } else {
          fs.renameSync(oldFile, newFile);
        }
      }
    }

    // Move current file to .1
    fs.renameSync(filePath, `${filePath}.1`);
  }

  private writeLog(category: string, entry: LogEntry): void {
    const fileName = this.getLogFileName(category, entry.level);
    this.rotateLogFile(fileName);

    const logLine = JSON.stringify(entry) + '\n';
    fs.appendFileSync(fileName, logLine);
  }

  private createLogEntry(level: LogEntry['level'], message: string, context?: string, data?: any, userId?: string, ip?: string, userAgent?: string): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      data: data ? JSON.stringify(data) : undefined,
      userId,
      ip,
      userAgent
    };
  }

  // Server logs
  info(message: string, context?: string, data?: any, userId?: string): void {
    const entry = this.createLogEntry('info', message, context, data, userId);
    this.writeLog('server', entry);
    console.log(`[INFO] ${message}`, data ? data : '');
  }

  warn(message: string, context?: string, data?: any, userId?: string): void {
    const entry = this.createLogEntry('warn', message, context, data, userId);
    this.writeLog('server', entry);
    console.warn(`[WARN] ${message}`, data ? data : '');
  }

  error(message: string, context?: string, data?: any, userId?: string): void {
    const entry = this.createLogEntry('error', message, context, data, userId);
    this.writeLog('errors', entry);
    console.error(`[ERROR] ${message}`, data ? data : '');
  }

  debug(message: string, context?: string, data?: any, userId?: string): void {
    const entry = this.createLogEntry('debug', message, context, data, userId);
    this.writeLog('debug', entry);
    console.log(`[DEBUG] ${message}`, data ? data : '');
  }

  // Access logs
  access(method: string, url: string, statusCode: number, responseTime: number, userId?: string, ip?: string, userAgent?: string): void {
    const entry = this.createLogEntry('info', `${method} ${url} ${statusCode}`, 'ACCESS', {
      method,
      url,
      statusCode,
      responseTime
    }, userId, ip, userAgent);
    
    this.writeLog('access', entry);
  }

  // Client logs (for client-side errors)
  clientError(message: string, context?: string, data?: any, userId?: string, ip?: string, userAgent?: string): void {
    const entry = this.createLogEntry('error', message, context, data, userId, ip, userAgent);
    this.writeLog('client', entry);
  }

  // Security logs
  security(message: string, context?: string, data?: any, userId?: string, ip?: string, userAgent?: string): void {
    const entry = this.createLogEntry('warn', message, context, data, userId, ip, userAgent);
    this.writeLog('errors', entry);
    console.warn(`[SECURITY] ${message}`, data ? data : '');
  }

  // Database logs
  database(message: string, context?: string, data?: any, userId?: string): void {
    const entry = this.createLogEntry('info', message, context, data, userId);
    this.writeLog('server', entry);
    console.log(`[DATABASE] ${message}`, data ? data : '');
  }

  // API logs
  api(message: string, context?: string, data?: any, userId?: string, ip?: string): void {
    const entry = this.createLogEntry('info', message, context, data, userId, ip);
    this.writeLog('server', entry);
    console.log(`[API] ${message}`, data ? data : '');
  }
}

// Export singleton instance
export const serverLogger = new ServerLogger();
export default serverLogger;
