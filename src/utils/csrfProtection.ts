/**
 * CSRF Protection Utility
 * Implements Cross-Site Request Forgery protection
 */

export interface CSRFToken {
  token: string;
  expiresAt: number;
}

export interface CSRFConfig {
  tokenLength: number;
  tokenExpiry: number; // in milliseconds
  headerName: string;
  cookieName: string;
}

export class CSRFProtection {
  private static readonly DEFAULT_CONFIG: CSRFConfig = {
    tokenLength: 32,
    tokenExpiry: 60 * 60 * 1000, // 1 hour
    headerName: 'X-CSRF-Token',
    cookieName: 'csrf-token'
  };

  private static config: CSRFConfig = CSRFProtection.DEFAULT_CONFIG;

  /**
   * Generate a secure random token string
   */
  private static generateTokenString(): string {
    const array = new Uint8Array(this.config.tokenLength);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Generate a new CSRF token
   */
  public static generateToken(): CSRFToken {
    const token = this.generateTokenString();
    const expiresAt = Date.now() + this.config.tokenExpiry;

    const tokenData: CSRFToken = {
      token,
      expiresAt
    };

    // Store token in sessionStorage
    sessionStorage.setItem('csrf_token', JSON.stringify(tokenData));

    // Also set as cookie for server-side validation
    document.cookie = `${this.config.cookieName}=${token}; path=/; secure; samesite=strict; max-age=${this.config.tokenExpiry / 1000}`;

    return tokenData;
  }

  /**
   * Get current valid token
   */
  public static getToken(): string | null {
    try {
      const stored = sessionStorage.getItem('csrf_token');
      if (!stored) return null;

      const tokenData: CSRFToken = JSON.parse(stored);
      
      if (Date.now() > tokenData.expiresAt) {
        this.clearToken();
        return null;
      }

      return tokenData.token;
    } catch {
      return null;
    }
  }

  /**
   * Validate a CSRF token
   */
  public static validateToken(token: string): boolean {
    const currentToken = this.getToken();
    return currentToken !== null && currentToken === token;
  }

  /**
   * Clear the CSRF token
   */
  public static clearToken(): void {
    sessionStorage.removeItem('csrf_token');
    document.cookie = `${this.config.cookieName}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
  }

  /**
   * Get CSRF token for use in forms
   */
  public static getTokenForForm(): string {
    let token = this.getToken();
    if (!token) {
      const tokenData = this.generateToken();
      token = tokenData.token;
    }
    return token;
  }

  /**
   * Add CSRF token to fetch request headers
   */
  public static addTokenToHeaders(headers: HeadersInit = {}): HeadersInit {
    const token = this.getTokenForForm();
    return {
      ...headers,
      [this.config.headerName]: token
    };
  }

  /**
   * Create a fetch wrapper with CSRF protection
   */
  public static protectedFetch(url: string, options: RequestInit = {}): Promise<Response> {
    const headers = this.addTokenToHeaders(options.headers);
    
    return fetch(url, {
      ...options,
      headers
    });
  }

  /**
   * Validate CSRF token from request
   */
  public static validateRequest(request: Request): boolean {
    const token = request.headers.get(this.config.headerName);
    if (!token) return false;

    return this.validateToken(token);
  }

  /**
   * Get CSRF token from cookie (for server-side validation)
   */
  public static getTokenFromCookie(): string | null {
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === this.config.cookieName) {
        return value;
      }
    }
    return null;
  }

  /**
   * Configure CSRF protection
   */
  public static configure(config: Partial<CSRFConfig>): void {
    this.config = { ...this.DEFAULT_CONFIG, ...config };
  }

  /**
   * Check if CSRF protection is enabled
   */
  public static isEnabled(): boolean {
    return this.getToken() !== null;
  }

  /**
   * Initialize CSRF protection
   */
  public static initialize(): void {
    // Generate initial token if none exists
    if (!this.getToken()) {
      this.generateToken();
    }
  }
}

/**
 * React hook for CSRF protection
 */
export const useCSRFProtection = () => {
  const getToken = () => CSRFProtection.getTokenForForm();
  const validateToken = (token: string) => CSRFProtection.validateToken(token);
  const clearToken = () => CSRFProtection.clearToken();
  const protectedFetch = (url: string, options: RequestInit = {}) => 
    CSRFProtection.protectedFetch(url, options);

  return {
    getToken,
    validateToken,
    clearToken,
    protectedFetch
  };
};

/**
 * Higher-order component for CSRF protection
 */
export const withCSRFProtection = <P extends object>(
  Component: React.ComponentType<P>
): React.ComponentType<P> => {
  return (props: P) => {
    React.useEffect(() => {
      CSRFProtection.initialize();
    }, []);

    return React.createElement(Component, props);
  };
};

// Initialize CSRF protection when module loads
if (typeof window !== 'undefined') {
  CSRFProtection.initialize();
}
