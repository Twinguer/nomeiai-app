
import DOMPurify from 'dompurify';

export class InputSanitizer {
  private static instance: InputSanitizer;

  private constructor() {
    // Configure DOMPurify for enhanced security
    DOMPurify.addHook('beforeSanitizeElements', (node, data) => {
      // Remove any script tags
      if ((data as any)?.tagName === 'script') {
        node.parentNode?.removeChild(node);
      }
    });
  }

  public static getInstance(): InputSanitizer {
    if (!InputSanitizer.instance) {
      InputSanitizer.instance = new InputSanitizer();
    }
    return InputSanitizer.instance;
  }

  public sanitizeHtml(input: string): string {
    return DOMPurify.sanitize(input, {
      ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u'],
      ALLOWED_ATTR: []
    });
  }

  public sanitizeText(input: string): string {
    return DOMPurify.sanitize(input.trim(), { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
  }

  public sanitizeEmail(email: string): string {
    const sanitized = this.sanitizeText(email).toLowerCase();
    // Additional email-specific validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sanitized)) {
      throw new Error('Invalid email format');
    }
    return sanitized;
  }

  public sanitizeNumeric(input: string | number): number {
    const num = typeof input === 'string' ? parseFloat(input) : input;
    if (isNaN(num) || !isFinite(num)) {
      throw new Error('Invalid numeric input');
    }
    return num;
  }
}

export const inputSanitizer = InputSanitizer.getInstance();
