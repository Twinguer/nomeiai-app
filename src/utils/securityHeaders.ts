/**
 * Security Headers Utility
 * Implements security headers for enhanced protection
 */

export interface SecurityHeadersConfig {
  contentSecurityPolicy?: string;
  xFrameOptions?: string;
  xContentTypeOptions?: string;
  xXSSProtection?: string;
  strictTransportSecurity?: string;
  referrerPolicy?: string;
  permissionsPolicy?: string;
}

export class SecurityHeaders {
  private static readonly DEFAULT_CONFIG: SecurityHeadersConfig = {
    // ✅ SEGURANÇA: Removido 'unsafe-inline' e 'unsafe-eval' do script-src
    // Se necessário para desenvolvimento, use getDevelopmentHeaders() com configuração específica
    contentSecurityPolicy: "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://*.supabase.co; frame-ancestors 'none';",
    xFrameOptions: 'DENY',
    xContentTypeOptions: 'nosniff',
    xXSSProtection: '1; mode=block',
    strictTransportSecurity: 'max-age=31536000; includeSubDomains; preload',
    referrerPolicy: 'strict-origin-when-cross-origin',
    permissionsPolicy: 'camera=(), microphone=(), geolocation=(), payment=()'
  };

  /**
   * Get security headers for HTTP responses
   */
  static getHeaders(config?: Partial<SecurityHeadersConfig>): Record<string, string> {
    const finalConfig = { ...this.DEFAULT_CONFIG, ...config };
    
    const headers: Record<string, string> = {};

    if (finalConfig.contentSecurityPolicy) {
      headers['Content-Security-Policy'] = finalConfig.contentSecurityPolicy;
    }

    if (finalConfig.xFrameOptions) {
      headers['X-Frame-Options'] = finalConfig.xFrameOptions;
    }

    if (finalConfig.xContentTypeOptions) {
      headers['X-Content-Type-Options'] = finalConfig.xContentTypeOptions;
    }

    if (finalConfig.xXSSProtection) {
      headers['X-XSS-Protection'] = finalConfig.xXSSProtection;
    }

    if (finalConfig.strictTransportSecurity) {
      headers['Strict-Transport-Security'] = finalConfig.strictTransportSecurity;
    }

    if (finalConfig.referrerPolicy) {
      headers['Referrer-Policy'] = finalConfig.referrerPolicy;
    }

    if (finalConfig.permissionsPolicy) {
      headers['Permissions-Policy'] = finalConfig.permissionsPolicy;
    }

    return headers;
  }

  /**
   * Get security headers for development environment
   */
  static getDevelopmentHeaders(): Record<string, string> {
    return this.getHeaders({
      // ✅ SEGURANÇA: Removido 'unsafe-inline' e 'unsafe-eval' do script-src
      // Nota: Vite HMR pode precisar de ajustes. Se houver problemas, adicionar 'unsafe-eval' apenas para dev
      contentSecurityPolicy: "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' http://localhost:* https://*.supabase.co ws://localhost:* wss://localhost:*; frame-ancestors 'none';",
      strictTransportSecurity: 'max-age=0' // Disable HSTS in development
    });
  }

  /**
   * Get security headers for production environment
   */
  static getProductionHeaders(): Record<string, string> {
    return this.getHeaders({
      contentSecurityPolicy: "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://*.supabase.co; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self';",
      strictTransportSecurity: 'max-age=31536000; includeSubDomains; preload'
    });
  }

  /**
   * Apply security headers to a Response object
   */
  static applyToResponse(response: Response, config?: Partial<SecurityHeadersConfig>): Response {
    const headers = this.getHeaders(config);
    
    // Clone the response and add security headers
    const newResponse = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: {
        ...Object.fromEntries(response.headers.entries()),
        ...headers
      }
    });

    return newResponse;
  }

  /**
   * Validate security headers in a response
   */
  static validateHeaders(response: Response): {
    isValid: boolean;
    missing: string[];
    warnings: string[];
  } {
    const requiredHeaders = [
      'Content-Security-Policy',
      'X-Frame-Options',
      'X-Content-Type-Options',
      'X-XSS-Protection',
      'Strict-Transport-Security',
      'Referrer-Policy'
    ];

    const missing: string[] = [];
    const warnings: string[] = [];

    for (const header of requiredHeaders) {
      if (!response.headers.has(header)) {
        missing.push(header);
      }
    }

    // Check for weak configurations
    const csp = response.headers.get('Content-Security-Policy');
    if (csp && csp.includes("'unsafe-inline'")) {
      warnings.push('CSP contains unsafe-inline directive');
    }

    if (csp && csp.includes("'unsafe-eval'")) {
      warnings.push('CSP contains unsafe-eval directive');
    }

    const hsts = response.headers.get('Strict-Transport-Security');
    if (hsts && hsts.includes('max-age=0')) {
      warnings.push('HSTS is disabled');
    }

    return {
      isValid: missing.length === 0,
      missing,
      warnings
    };
  }
}

/**
 * Middleware function for Express.js applications
 */
export const securityHeadersMiddleware = (config?: Partial<SecurityHeadersConfig>) => {
  return (req: any, res: any, next: any) => {
    const headers = SecurityHeaders.getHeaders(config);
    
    for (const [key, value] of Object.entries(headers)) {
      res.setHeader(key, value);
    }
    
    next();
  };
};

/**
 * React hook for applying security headers in client-side applications
 */
export const useSecurityHeaders = (config?: Partial<SecurityHeadersConfig>) => {
  const applyHeaders = () => {
    const headers = SecurityHeaders.getHeaders(config);
    
    // Apply headers to meta tags
    Object.entries(headers).forEach(([key, value]) => {
      const meta = document.querySelector(`meta[http-equiv="${key}"]`);
      if (meta) {
        meta.setAttribute('content', value);
      } else {
        const newMeta = document.createElement('meta');
        newMeta.setAttribute('http-equiv', key);
        newMeta.setAttribute('content', value);
        document.head.appendChild(newMeta);
      }
    });
  };

  return { applyHeaders };
};
