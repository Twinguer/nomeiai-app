/**
 * Password Validation Utility
 * Implements robust password security requirements
 */

export interface PasswordValidationResult {
  isValid: boolean;
  score: number; // 0-100
  errors: string[];
  suggestions: string[];
}

export interface PasswordRequirements {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  maxLength: number;
  forbiddenPatterns: RegExp[];
}

export class PasswordValidator {
  private static readonly DEFAULT_REQUIREMENTS: PasswordRequirements = {
    minLength: 8, // Standard minimum
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    maxLength: 128, // Reasonable limit
    forbiddenPatterns: [
      /(.)\1{4,}/g, // No 5+ consecutive identical characters (relaxed)
      /123456789|abcdefgh|qwertyui|password123|admin123|user123/gi, // Very common patterns only
      /^\d+$/, // Not all numbers
      /^[a-zA-Z]+$/, // Not all letters
    ]
  };

  /**
   * Validate password against security requirements
   */
  static validate(password: string, requirements?: Partial<PasswordRequirements>): PasswordValidationResult {
    const req = { ...this.DEFAULT_REQUIREMENTS, ...requirements };
    const errors: string[] = [];
    const suggestions: string[] = [];
    let score = 0;

    // Length validation
    if (password.length < req.minLength) {
      errors.push(`Senha deve ter pelo menos ${req.minLength} caracteres`);
    } else {
      score += 20;
    }

    if (password.length > req.maxLength) {
      errors.push(`Senha deve ter no máximo ${req.maxLength} caracteres`);
    }

    // Character type validation
    if (req.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Senha deve conter pelo menos uma letra maiúscula');
    } else if (req.requireUppercase) {
      score += 15;
    }

    if (req.requireLowercase && !/[a-z]/.test(password)) {
      errors.push('Senha deve conter pelo menos uma letra minúscula');
    } else if (req.requireLowercase) {
      score += 15;
    }

    if (req.requireNumbers && !/\d/.test(password)) {
      errors.push('Senha deve conter pelo menos um número');
    } else if (req.requireNumbers) {
      score += 15;
    }

    if (req.requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Senha deve conter pelo menos um caractere especial (!@#$%^&*(),.?":{}|<>)');
    } else if (req.requireSpecialChars) {
      score += 15;
    }

    // Pattern validation
    for (const pattern of req.forbiddenPatterns) {
      if (pattern.test(password)) {
        if (pattern.source.includes('\\1')) {
          errors.push('Senha não pode conter 4 ou mais caracteres idênticos consecutivos');
        } else if (pattern.source.includes('123456|abcdef|qwerty|password|admin|user')) {
          errors.push('Senha não pode conter sequências comuns (123456, abcdef, qwerty, password, admin, user)');
        } else if (pattern.source.includes('^\\d+$')) {
          errors.push('Senha não pode conter apenas números');
        } else if (pattern.source.includes('^[a-zA-Z]+$')) {
          errors.push('Senha não pode conter apenas letras');
        }
      }
    }

    // Entropy calculation (very relaxed)
    const entropy = this.calculateEntropy(password);
    if (entropy < 20) {
      errors.push('Senha muito previsível');
      suggestions.push('Use uma combinação mais aleatória de caracteres');
    } else {
      score += Math.min(entropy / 2, 20);
    }

    // Common password check (very relaxed - only very obvious patterns)
    if (this.isCommonPassword(password)) {
      // Only warn, don't block
      suggestions.push('Considere usar uma senha mais única');
    }

    // Generate suggestions if password is weak
    if (score < 40) {
      suggestions.push('Combine letras maiúsculas, minúsculas, números e símbolos');
      suggestions.push('Use pelo menos 8 caracteres');
      suggestions.push('Evite informações pessoais óbvias');
      suggestions.push('Considere usar uma frase secreta');
    }

    return {
      isValid: errors.length === 0,
      score: Math.min(score, 100),
      errors,
      suggestions
    };
  }

  /**
   * Calculate password entropy
   */
  private static calculateEntropy(password: string): number {
    const charSet = new Set(password);
    const charsetSize = charSet.size;
    const length = password.length;
    
    // Entropy = log2(charset_size^length)
    return Math.log2(Math.pow(charsetSize, length));
  }

  /**
   * Check if password is in common passwords list
   */
  private static isCommonPassword(password: string): boolean {
    const commonPasswords = [
      'password', '123456', '123456789', 'qwerty', 'abc123',
      'password123', 'admin', 'letmein', 'welcome', 'monkey',
      '1234567890', 'password1', 'qwerty123', 'dragon', 'master',
      'hello', 'freedom', 'whatever', 'qazwsx', 'trustno1'
    ];
    
    return commonPasswords.includes(password.toLowerCase());
  }

  /**
   * Generate a secure password suggestion
   */
  static generateSuggestion(): string {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const special = '!@#$%^&*(),.?":{}|<>';
    
    let password = '';
    
    // Ensure at least one of each type
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += special[Math.floor(Math.random() * special.length)];
    
    // Fill remaining length with random characters
    const allChars = uppercase + lowercase + numbers + special;
    for (let i = 4; i < 16; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }
    
    // Shuffle the password
    return password.split('').sort(() => Math.random() - 0.5).join('');
  }
}
