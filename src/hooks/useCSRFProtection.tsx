import { useEffect, useState, useCallback } from 'react';
import { CSRFProtection } from '@/utils/csrfProtection';

/**
 * Hook React para proteção CSRF
 */
export const useCSRFProtection = () => {
  const [token, setToken] = useState<string>('');

  useEffect(() => {
    // Gerar token na montagem do componente
    const newToken = CSRFProtection.getTokenForForm();
    setToken(newToken);
  }, []);

  const getToken = useCallback(() => {
    return CSRFProtection.getTokenForForm();
  }, []);

  const validateToken = useCallback((tokenToValidate: string) => {
    return CSRFProtection.validateToken(tokenToValidate);
  }, []);

  const refreshToken = useCallback(() => {
    const newTokenData = CSRFProtection.generateToken();
    setToken(newTokenData.token);
    return newTokenData.token;
  }, []);

  const protectedFetch = useCallback((url: string, options: RequestInit = {}) => {
    return CSRFProtection.protectedFetch(url, options);
  }, []);

  return {
    token,
    getToken,
    validateToken,
    refreshToken,
    protectedFetch
  };
};
