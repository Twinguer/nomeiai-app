/**
 * Session Security Utility
 * Implements secure session management
 */

export interface SessionConfig {
  maxAge: number; // in milliseconds
  refreshThreshold: number; // refresh when this much time is left
  secure: boolean;
  sameSite: 'strict' | 'lax' | 'none';
  httpOnly: boolean;
}

export interface SessionData {
  userId: string;
  sessionId: string;
  createdAt: number;
  lastActivity: number;
  expiresAt: number;
  ipAddress?: string;
  userAgent?: string;
}

export class SessionSecurity {
  private static readonly DEFAULT_CONFIG: SessionConfig = {
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    refreshThreshold: 2 * 60 * 60 * 1000, // 2 hours
    secure: import.meta.env.PROD,
    sameSite: 'strict',
    httpOnly: false // Can't be true for client-side access
  };

  private static config: SessionConfig = SessionSecurity.DEFAULT_CONFIG;

  /**
   * Generate a secure session ID
   */
  private static generateSessionId(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Get client fingerprint for session validation
   */
  private static getClientFingerprint(): string {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx?.fillText('Session fingerprint', 10, 10);
    
    const fingerprint = [
      navigator.userAgent,
      navigator.language,
      screen.width + 'x' + screen.height,
      new Date().getTimezoneOffset(),
      canvas.toDataURL()
    ].join('|');
    
    // Simple hash
    let hash = 0;
    for (let i = 0; i < fingerprint.length; i++) {
      const char = fingerprint.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return Math.abs(hash).toString(16);
  }

  /**
   * Create a new secure session
   */
  public static createSession(userId: string): SessionData {
    const now = Date.now();
    const sessionId = this.generateSessionId();
    
    const sessionData: SessionData = {
      userId,
      sessionId,
      createdAt: now,
      lastActivity: now,
      expiresAt: now + this.config.maxAge,
      ipAddress: this.getClientIP(),
      userAgent: navigator.userAgent
    };

    // Store session data
    sessionStorage.setItem('session_data', JSON.stringify(sessionData));
    
    // Set session cookie
    this.setSessionCookie(sessionId);

    return sessionData;
  }

  /**
   * Get current session data
   */
  public static getSession(): SessionData | null {
    try {
      const stored = sessionStorage.getItem('session_data');
      if (!stored) return null;

      const sessionData: SessionData = JSON.parse(stored);
      
      // Check if session is expired
      if (Date.now() > sessionData.expiresAt) {
        this.clearSession();
        return null;
      }

      // Update last activity
      sessionData.lastActivity = Date.now();
      sessionStorage.setItem('session_data', JSON.stringify(sessionData));

      return sessionData;
    } catch {
      return null;
    }
  }

  /**
   * Validate session integrity
   */
  public static validateSession(): boolean {
    const session = this.getSession();
    if (!session) return false;

    // Check if session ID matches cookie
    const cookieSessionId = this.getSessionIdFromCookie();
    if (cookieSessionId !== session.sessionId) {
      this.clearSession();
      return false;
    }

    // Check client fingerprint (basic validation)
    const currentFingerprint = this.getClientFingerprint();
    const storedFingerprint = sessionStorage.getItem('client_fingerprint');
    
    if (!storedFingerprint) {
      sessionStorage.setItem('client_fingerprint', currentFingerprint);
    } else if (storedFingerprint !== currentFingerprint) {
      // Fingerprint changed - potential session hijacking
      this.clearSession();
      return false;
    }

    return true;
  }

  /**
   * Refresh session if needed
   */
  public static refreshSessionIfNeeded(): boolean {
    const session = this.getSession();
    if (!session) return false;

    const timeUntilExpiry = session.expiresAt - Date.now();
    
    if (timeUntilExpiry < this.config.refreshThreshold) {
      // Refresh session
      session.expiresAt = Date.now() + this.config.maxAge;
      session.lastActivity = Date.now();
      
      sessionStorage.setItem('session_data', JSON.stringify(session));
      this.setSessionCookie(session.sessionId);
      
      return true;
    }

    return false;
  }

  /**
   * Clear session data
   */
  public static clearSession(): void {
    sessionStorage.removeItem('session_data');
    sessionStorage.removeItem('client_fingerprint');
    this.clearSessionCookie();
  }

  /**
   * Set session cookie
   */
  private static setSessionCookie(sessionId: string): void {
    const expires = new Date(Date.now() + this.config.maxAge).toUTCString();
    const secure = this.config.secure ? '; secure' : '';
    const sameSite = `; samesite=${this.config.sameSite}`;
    
    document.cookie = `session_id=${sessionId}; path=/; expires=${expires}${secure}${sameSite}`;
  }

  /**
   * Clear session cookie
   */
  private static clearSessionCookie(): void {
    document.cookie = 'session_id=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
  }

  /**
   * Get session ID from cookie
   */
  private static getSessionIdFromCookie(): string | null {
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === 'session_id') {
        return value;
      }
    }
    return null;
  }

  /**
   * Get client IP (approximation)
   */
  private static getClientIP(): string {
    // This is a placeholder - in a real app, you'd get this from the server
    return 'unknown';
  }

  /**
   * Check if session is about to expire
   */
  public static isSessionExpiringSoon(): boolean {
    const session = this.getSession();
    if (!session) return false;

    const timeUntilExpiry = session.expiresAt - Date.now();
    return timeUntilExpiry < this.config.refreshThreshold;
  }

  /**
   * Get session age in minutes
   */
  public static getSessionAge(): number {
    const session = this.getSession();
    if (!session) return 0;

    return Math.floor((Date.now() - session.createdAt) / (1000 * 60));
  }

  /**
   * Configure session security
   */
  public static configure(config: Partial<SessionConfig>): void {
    this.config = { ...this.DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize session security
   */
  public static initialize(): void {
    // Validate existing session
    if (!this.validateSession()) {
      this.clearSession();
    }
  }
}

/**
 * React hook for session security
 */
export const useSessionSecurity = () => {
  const getSession = () => SessionSecurity.getSession();
  const validateSession = () => SessionSecurity.validateSession();
  const refreshSession = () => SessionSecurity.refreshSessionIfNeeded();
  const clearSession = () => SessionSecurity.clearSession();
  const isExpiringSoon = () => SessionSecurity.isSessionExpiringSoon();
  const getSessionAge = () => SessionSecurity.getSessionAge();

  return {
    getSession,
    validateSession,
    refreshSession,
    clearSession,
    isExpiringSoon,
    getSessionAge
  };
};

// Initialize session security when module loads
if (typeof window !== 'undefined') {
  SessionSecurity.initialize();
}
