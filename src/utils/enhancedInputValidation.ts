/**
 * Enhanced Input Validation Utility
 * Provides comprehensive input validation and sanitization
 */

export interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  custom?: (value: any) => boolean | string;
  sanitize?: boolean;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  sanitizedValue?: any;
}

export class EnhancedInputValidator {
  private static readonly COMMON_PATTERNS = {
    email: /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/,
    phone: /^[\+]?[1-9][\d]{0,15}$/,
    url: /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/,
    uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    alphanumeric: /^[a-zA-Z0-9]+$/,
    noSpecialChars: /^[a-zA-Z0-9\s]+$/
  };

  /**
   * Sanitize input to prevent XSS and other attacks
   */
  private static sanitizeInput(input: any): any {
    if (typeof input === 'string') {
      // Remove null bytes
      let sanitized = input.replace(/\0/g, '');
      
      // Remove control characters except newlines and tabs
      sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
      
      // Trim whitespace
      sanitized = sanitized.trim();
      
      return sanitized;
    }
    
    if (typeof input === 'number') {
      return isNaN(input) ? 0 : input;
    }
    
    if (Array.isArray(input)) {
      return input.map(item => this.sanitizeInput(item));
    }
    
    if (input && typeof input === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(input)) {
        sanitized[key] = this.sanitizeInput(value);
      }
      return sanitized;
    }
    
    return input;
  }

  /**
   * Validate input against rules
   */
  public static validate(value: any, rules: ValidationRule): ValidationResult {
    const errors: string[] = [];
    let sanitizedValue = value;

    // Sanitize if requested
    if (rules.sanitize !== false) {
      sanitizedValue = this.sanitizeInput(value);
    }

    // Required validation
    if (rules.required && (sanitizedValue === null || sanitizedValue === undefined || sanitizedValue === '')) {
      errors.push('Este campo é obrigatório');
    }

    // Skip other validations if value is empty and not required
    if (!rules.required && (sanitizedValue === null || sanitizedValue === undefined || sanitizedValue === '')) {
      return { isValid: true, errors: [], sanitizedValue };
    }

    // Length validations
    if (typeof sanitizedValue === 'string') {
      if (rules.minLength && sanitizedValue.length < rules.minLength) {
        errors.push(`Deve ter pelo menos ${rules.minLength} caracteres`);
      }
      
      if (rules.maxLength && sanitizedValue.length > rules.maxLength) {
        errors.push(`Deve ter no máximo ${rules.maxLength} caracteres`);
      }
    }

    // Pattern validation
    if (rules.pattern && typeof sanitizedValue === 'string' && !rules.pattern.test(sanitizedValue)) {
      errors.push('Formato inválido');
    }

    // Custom validation
    if (rules.custom) {
      const customResult = rules.custom(sanitizedValue);
      if (customResult !== true) {
        errors.push(typeof customResult === 'string' ? customResult : 'Valor inválido');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedValue
    };
  }

  /**
   * Validate email
   */
  public static validateEmail(email: string): ValidationResult {
    return this.validate(email, {
      required: true,
      pattern: this.COMMON_PATTERNS.email,
      maxLength: 254,
      sanitize: true
    });
  }

  /**
   * Validate password
   */
  public static validatePassword(password: string): ValidationResult {
    return this.validate(password, {
      required: true,
      minLength: 8,
      maxLength: 128,
      sanitize: true,
      custom: (value) => {
        const hasUpper = /[A-Z]/.test(value);
        const hasLower = /[a-z]/.test(value);
        const hasNumber = /\d/.test(value);
        const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(value);
        
        if (!hasUpper) return 'Deve conter pelo menos uma letra maiúscula';
        if (!hasLower) return 'Deve conter pelo menos uma letra minúscula';
        if (!hasNumber) return 'Deve conter pelo menos um número';
        if (!hasSpecial) return 'Deve conter pelo menos um caractere especial';
        
        return true;
      }
    });
  }

  /**
   * Validate UUID
   */
  public static validateUUID(uuid: string): ValidationResult {
    return this.validate(uuid, {
      required: true,
      pattern: this.COMMON_PATTERNS.uuid,
      sanitize: true
    });
  }

  /**
   * Validate URL
   */
  public static validateURL(url: string): ValidationResult {
    return this.validate(url, {
      required: true,
      pattern: this.COMMON_PATTERNS.url,
      maxLength: 2048,
      sanitize: true
    });
  }

  /**
   * Validate phone number
   */
  public static validatePhone(phone: string): ValidationResult {
    return this.validate(phone, {
      required: true,
      pattern: this.COMMON_PATTERNS.phone,
      minLength: 10,
      maxLength: 16,
      sanitize: true
    });
  }

  /**
   * Validate text input
   */
  public static validateText(text: string, options: {
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    allowSpecialChars?: boolean;
  } = {}): ValidationResult {
    const rules: ValidationRule = {
      required: options.required,
      minLength: options.minLength,
      maxLength: options.maxLength,
      sanitize: true
    };

    if (!options.allowSpecialChars) {
      rules.pattern = this.COMMON_PATTERNS.noSpecialChars;
    }

    return this.validate(text, rules);
  }

  /**
   * Validate JSON input
   */
  public static validateJSON(jsonString: string): ValidationResult {
    try {
      const parsed = JSON.parse(jsonString);
      return {
        isValid: true,
        errors: [],
        sanitizedValue: parsed
      };
    } catch (error) {
      return {
        isValid: false,
        errors: ['JSON inválido'],
        sanitizedValue: jsonString
      };
    }
  }

  /**
   * Validate file upload
   */
  public static validateFile(file: File, options: {
    maxSize?: number; // in bytes
    allowedTypes?: string[];
    required?: boolean;
  } = {}): ValidationResult {
    const errors: string[] = [];

    if (options.required && !file) {
      errors.push('Arquivo é obrigatório');
      return { isValid: false, errors };
    }

    if (!file) {
      return { isValid: true, errors: [] };
    }

    if (options.maxSize && file.size > options.maxSize) {
      errors.push(`Arquivo muito grande. Máximo: ${Math.round(options.maxSize / 1024 / 1024)}MB`);
    }

    if (options.allowedTypes && !options.allowedTypes.includes(file.type)) {
      errors.push(`Tipo de arquivo não permitido. Permitidos: ${options.allowedTypes.join(', ')}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedValue: file
    };
  }
}

/**
 * React hook for input validation
 */
export const useInputValidation = () => {
  const validate = (value: any, rules: ValidationRule) => 
    EnhancedInputValidator.validate(value, rules);

  const validateEmail = (email: string) => 
    EnhancedInputValidator.validateEmail(email);

  const validatePassword = (password: string) => 
    EnhancedInputValidator.validatePassword(password);

  const validateUUID = (uuid: string) => 
    EnhancedInputValidator.validateUUID(uuid);

  const validateURL = (url: string) => 
    EnhancedInputValidator.validateURL(url);

  const validatePhone = (phone: string) => 
    EnhancedInputValidator.validatePhone(phone);

  const validateText = (text: string, options?: any) => 
    EnhancedInputValidator.validateText(text, options);

  const validateJSON = (jsonString: string) => 
    EnhancedInputValidator.validateJSON(jsonString);

  const validateFile = (file: File, options?: any) => 
    EnhancedInputValidator.validateFile(file, options);

  return {
    validate,
    validateEmail,
    validatePassword,
    validateUUID,
    validateURL,
    validatePhone,
    validateText,
    validateJSON,
    validateFile
  };
};
