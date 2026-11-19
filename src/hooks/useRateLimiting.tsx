
import { useState, useCallback } from 'react';
import { devLog, sanitizeForLog } from '@/utils/productionLogger';

interface RateLimitConfig {
  maxAttempts: number;
  windowMs: number;
  blockDurationMs: number;
}

export const useRateLimiting = (key: string, config: RateLimitConfig) => {
  const [isBlocked, setIsBlocked] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [blockUntil, setBlockUntil] = useState<number | null>(null);

  const checkRateLimit = useCallback((): boolean => {
    const storageKey = `rate_limit_${key}`;
    const storedData = localStorage.getItem(storageKey);
    
    let rateLimitData = {
      attempts: 0,
      windowStart: Date.now(),
      blockUntil: null as number | null
    };

    if (storedData) {
      try {
        rateLimitData = JSON.parse(storedData);
      } catch (error) {
        devLog.error('Error parsing rate limit data:', error);
      }
    }

    const now = Date.now();

    // Check if currently blocked
    if (rateLimitData.blockUntil && now < rateLimitData.blockUntil) {
      setIsBlocked(true);
      setBlockUntil(rateLimitData.blockUntil);
      return false;
    }

    // Reset window if expired
    if (now - rateLimitData.windowStart > config.windowMs) {
      rateLimitData = {
        attempts: 0,
        windowStart: now,
        blockUntil: null
      };
    }

    // Check if exceeded attempts
    if (rateLimitData.attempts >= config.maxAttempts) {
      rateLimitData.blockUntil = now + config.blockDurationMs;
      setIsBlocked(true);
      setBlockUntil(rateLimitData.blockUntil);
      localStorage.setItem(storageKey, JSON.stringify(rateLimitData));
      return false;
    }

    // Increment attempts
    rateLimitData.attempts++;
    setAttempts(rateLimitData.attempts);
    localStorage.setItem(storageKey, JSON.stringify(rateLimitData));

    return true;
  }, [key, config]);

  const resetRateLimit = useCallback(() => {
    const storageKey = `rate_limit_${key}`;
    localStorage.removeItem(storageKey);
    setIsBlocked(false);
    setAttempts(0);
    setBlockUntil(null);
  }, [key]);

  return {
    isBlocked,
    attempts,
    blockUntil,
    checkRateLimit,
    resetRateLimit
  };
};
