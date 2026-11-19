import { useEffect } from 'react';
import { TokenCleanupService } from '@/services/tokenCleanupService';

// Hook para gerenciar limpeza automática de tokens
export const useTokenCleanup = () => {
  useEffect(() => {
    // Iniciar limpeza automática quando o hook for montado
    TokenCleanupService.startAutomaticCleanup();

    // Cleanup quando o componente for desmontado
    return () => {
      TokenCleanupService.stopAutomaticCleanup();
    };
  }, []);

  // Funções utilitárias para controle manual
  const cleanupNow = () => {
    TokenCleanupService.cleanupExpiredTokens();
  };

  const clearAllTokens = () => {
    TokenCleanupService.clearAllTokens();
  };

  const getTokenStats = () => {
    return TokenCleanupService.getTokenStats();
  };

  return {
    cleanupNow,
    clearAllTokens,
    getTokenStats
  };
};
