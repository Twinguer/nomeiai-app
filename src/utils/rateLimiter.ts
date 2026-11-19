/**
 * Advanced Rate Limiting Utility
 * Implements multiple rate limiting strategies for enhanced security
 */

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  keyGenerator?: (identifier: string) => string; // Custom key generator
  skipSuccessfulRequests?: boolean; // Don't count successful requests
  skipFailedRequests?: boolean; // Don't count failed requests
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

class RateLimiter {
  private static instances: Map<string, RateLimiter> = new Map();
  private requests: Map<string, number[]> = new Map();
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  /**
   * Get or create a rate limiter instance
   */
  static getInstance(name: string, config: RateLimitConfig): RateLimiter {
    if (!this.instances.has(name)) {
      this.instances.set(name, new RateLimiter(config));
    }
    return this.instances.get(name)!;
  }

  /**
   * Check if request is allowed
   */
  check(identifier: string, isSuccess: boolean = true): RateLimitResult {
    const key = this.config.keyGenerator 
      ? this.config.keyGenerator(identifier)
      : identifier;

    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    // Get existing requests for this key
    let requests = this.requests.get(key) || [];
    
    // Remove old requests outside the window
    requests = requests.filter(timestamp => timestamp > windowStart);
    
    // Check if we should count this request
    const shouldCount = (isSuccess && !this.config.skipSuccessfulRequests) ||
                       (!isSuccess && !this.config.skipFailedRequests);

    if (shouldCount) {
      requests.push(now);
    }

    // Store updated requests
    this.requests.set(key, requests);

    const requestCount = requests.length;
    const allowed = requestCount <= this.config.maxRequests;
    const remaining = Math.max(0, this.config.maxRequests - requestCount);
    const resetTime = requests.length > 0 ? requests[0] + this.config.windowMs : now + this.config.windowMs;
    const retryAfter = !allowed ? Math.ceil((resetTime - now) / 1000) : undefined;

    return {
      allowed,
      remaining,
      resetTime,
      retryAfter
    };
  }

  /**
   * Reset rate limit for a specific identifier
   */
  reset(identifier: string): void {
    const key = this.config.keyGenerator 
      ? this.config.keyGenerator(identifier)
      : identifier;
    this.requests.delete(key);
  }

  /**
   * Get current status for an identifier
   */
  getStatus(identifier: string): RateLimitResult {
    const key = this.config.keyGenerator 
      ? this.config.keyGenerator(identifier)
      : identifier;

    const now = Date.now();
    const windowStart = now - this.config.windowMs;
    const requests = this.requests.get(key) || [];
    const validRequests = requests.filter(timestamp => timestamp > windowStart);
    
    const requestCount = validRequests.length;
    const allowed = requestCount <= this.config.maxRequests;
    const remaining = Math.max(0, this.config.maxRequests - requestCount);
    const resetTime = validRequests.length > 0 ? validRequests[0] + this.config.windowMs : now + this.config.windowMs;

    return {
      allowed,
      remaining,
      resetTime
    };
  }

  /**
   * Clean up old entries (call periodically)
   */
  cleanup(): void {
    const now = Date.now();
    const cutoff = now - this.config.windowMs * 2; // Keep some buffer

    for (const [key, requests] of this.requests.entries()) {
      const validRequests = requests.filter(timestamp => timestamp > cutoff);
      if (validRequests.length === 0) {
        this.requests.delete(key);
      } else {
        this.requests.set(key, validRequests);
      }
    }
  }
}

/**
 * Predefined rate limiters for common use cases
 */
export const RateLimiters = {
  // Authentication rate limiting
  auth: RateLimiter.getInstance('auth', {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5, // 5 attempts per 15 minutes
    keyGenerator: (identifier) => `auth:${identifier}`,
    skipSuccessfulRequests: true
  }),

  // API rate limiting
  api: RateLimiter.getInstance('api', {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100, // 100 requests per minute
    keyGenerator: (identifier) => `api:${identifier}`
  }),

  // Password reset rate limiting
  passwordReset: RateLimiter.getInstance('passwordReset', {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 3, // 3 attempts per hour
    keyGenerator: (identifier) => `password_reset:${identifier}`
  }),

  // Ranking creation rate limiting
  rankingCreation: RateLimiter.getInstance('rankingCreation', {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 10, // 10 rankings per hour
    keyGenerator: (identifier) => `ranking_create:${identifier}`
  }),

  // General user actions
  userActions: RateLimiter.getInstance('userActions', {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30, // 30 actions per minute
    keyGenerator: (identifier) => `user_actions:${identifier}`
  })
};

/**
 * Cleanup function to call periodically
 */
export const cleanupRateLimiters = (): void => {
  for (const limiter of RateLimiter['instances'].values()) {
    limiter.cleanup();
  }
};

/**
 * Hook for React components to use rate limiting
 */
export const useRateLimit = (limiterName: keyof typeof RateLimiters, identifier: string) => {
  const limiter = RateLimiters[limiterName];
  
  const check = (isSuccess: boolean = true) => {
    return limiter.check(identifier, isSuccess);
  };

  const reset = () => {
    limiter.reset(identifier);
  };

  const getStatus = () => {
    return limiter.getStatus(identifier);
  };

  return { check, reset, getStatus };
};

// Cleanup every 5 minutes
if (typeof window !== 'undefined') {
  setInterval(cleanupRateLimiters, 5 * 60 * 1000);
}
