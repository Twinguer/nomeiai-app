
export class SecurityValidators {
  // SQL injection prevention patterns
  private static SQL_INJECTION_PATTERNS = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/gi,
    /(--|\/\*|\*\/|;|'|"|`)/g,
    /(\bOR\b|\bAND\b).*?[=<>]/gi
  ];

  // XSS prevention patterns
  private static XSS_PATTERNS = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<img[^>]+src[^>]*>/gi
  ];

  public static validateInput(input: string): { isValid: boolean; reason?: string } {
    if (!input || typeof input !== 'string') {
      return { isValid: false, reason: 'Input must be a non-empty string' };
    }

    // Check length limits
    if (input.length > 10000) {
      return { isValid: false, reason: 'Input exceeds maximum length' };
    }

    // Check for SQL injection patterns
    for (const pattern of this.SQL_INJECTION_PATTERNS) {
      if (pattern.test(input)) {
        return { isValid: false, reason: 'Potentially dangerous SQL pattern detected' };
      }
    }

    // Check for XSS patterns
    for (const pattern of this.XSS_PATTERNS) {
      if (pattern.test(input)) {
        return { isValid: false, reason: 'Potentially dangerous script pattern detected' };
      }
    }

    return { isValid: true };
  }

  public static validateUUID(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  public static validateNumericRange(value: number, min: number, max: number): boolean {
    return !isNaN(value) && isFinite(value) && value >= min && value <= max;
  }

  public static sanitizeFileName(fileName: string): string {
    return fileName
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .replace(/\.{2,}/g, '.')
      .substring(0, 255);
  }

  public static validateFileUpload(file: File): { isValid: boolean; reason?: string } {
    // Usar o sistema padronizado de validação
    // Importação dinâmica para evitar dependência circular
    const { validateFileUploadSimple } = require('@/utils/fileUploadValidator') as typeof import('@/utils/fileUploadValidator');
    const validation = validateFileUploadSimple(file, 'GENERIC', file.type.startsWith('image/'));
    
    if (!validation.isValid) {
      return { isValid: false, reason: validation.errors.join('. ') };
    }
    
    return { isValid: true };
  }
}
