import { logInfo, logWarn } from '@/utils/secureLogger';

// Serviço para limpeza automática de tokens expirados
export class TokenCleanupService {
  private static cleanupInterval: NodeJS.Timeout | null = null;
  private static readonly CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hora
  private static readonly TOKEN_EXPIRY_TIME = 24 * 60 * 60 * 1000; // 24 horas

  // Iniciar limpeza automática
  static startAutomaticCleanup(): void {
    if (this.cleanupInterval) {
      // Debug logs removed for security
      return;
    }

    // Debug logs removed for security
    
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredTokens();
    }, this.CLEANUP_INTERVAL);

    // Executar limpeza imediatamente
    this.cleanupExpiredTokens();
  }

  // Parar limpeza automática
  static stopAutomaticCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      // Debug logs removed for security
    }
  }

  // Limpar tokens expirados
  static cleanupExpiredTokens(): void {
    try {
      const now = Date.now();
      let cleanedCount = 0;

      // ✅ SEGURANÇA: Limpar tokens de ambos localStorage e sessionStorage
      // Limpar tokens do localStorage (legado - manter por compatibilidade)
      const keysToRemoveLocal: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && this.isTokenKey(key)) {
          try {
            const tokenData = JSON.parse(localStorage.getItem(key) || '{}');
            if (tokenData.expiresAt && now > tokenData.expiresAt) {
              keysToRemoveLocal.push(key);
            }
          } catch (error) {
            // Token inválido, remover
            keysToRemoveLocal.push(key);
          }
        }
      }

      // Limpar tokens do sessionStorage (novo padrão)
      const keysToRemoveSession: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && this.isTokenKey(key)) {
          try {
            const tokenData = JSON.parse(sessionStorage.getItem(key) || '{}');
            if (tokenData.expiresAt && now > tokenData.expiresAt) {
              keysToRemoveSession.push(key);
            }
          } catch (error) {
            // Token inválido, remover
            keysToRemoveSession.push(key);
          }
        }
      }

      // Remover tokens expirados
      keysToRemoveLocal.forEach(key => {
        localStorage.removeItem(key);
        cleanedCount++;
      });
      keysToRemoveSession.forEach(key => {
        sessionStorage.removeItem(key);
        cleanedCount++;
      });

      if (cleanedCount > 0) {
        logInfo('Cleaned expired tokens', { count: cleanedCount }, 'TOKEN_CLEANUP');
      }

    } catch (error) {
      logWarn('Error during token cleanup', { error: error instanceof Error ? error.message : 'Unknown error' }, 'TOKEN_CLEANUP');
    }
  }

  // Verificar se uma chave é de token
  private static isTokenKey(key: string): boolean {
    return key.includes('_token_') || 
           key.includes('user_token_') || 
           key.includes('concurso_token_') || 
           key.includes('study_cycle_token_') || 
           key.includes('admin_token_') || 
           key.includes('community_token_');
  }

  // Limpar todos os tokens (para logout)
  static clearAllTokens(): void {
    try {
      const keysToRemoveLocal: string[] = [];
      const keysToRemoveSession: string[] = [];
      
      // Limpar do localStorage (legado)
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && this.isTokenKey(key)) {
          keysToRemoveLocal.push(key);
        }
      }

      // Limpar do sessionStorage (novo padrão)
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && this.isTokenKey(key)) {
          keysToRemoveSession.push(key);
        }
      }

      keysToRemoveLocal.forEach(key => {
        localStorage.removeItem(key);
      });
      keysToRemoveSession.forEach(key => {
        sessionStorage.removeItem(key);
      });

      const totalCount = keysToRemoveLocal.length + keysToRemoveSession.length;
      logInfo('Cleared all tokens', { count: totalCount }, 'TOKEN_CLEANUP');
    } catch (error) {
      logWarn('Error clearing all tokens', { error: error instanceof Error ? error.message : 'Unknown error' }, 'TOKEN_CLEANUP');
    }
  }

  // Obter estatísticas de tokens
  static getTokenStats(): { total: number; expired: number; valid: number } {
    const now = Date.now();
    let total = 0;
    let expired = 0;
    let valid = 0;

    // Contar tokens do localStorage (legado)
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && this.isTokenKey(key)) {
        total++;
        try {
          const tokenData = JSON.parse(localStorage.getItem(key) || '{}');
          if (tokenData.expiresAt && now > tokenData.expiresAt) {
            expired++;
          } else {
            valid++;
          }
        } catch (error) {
          expired++; // Token inválido conta como expirado
        }
      }
    }

    // Contar tokens do sessionStorage (novo padrão)
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && this.isTokenKey(key)) {
        total++;
        try {
          const tokenData = JSON.parse(sessionStorage.getItem(key) || '{}');
          if (tokenData.expiresAt && now > tokenData.expiresAt) {
            expired++;
          } else {
            valid++;
          }
        } catch (error) {
          expired++; // Token inválido conta como expirado
        }
      }
    }

    return { total, expired, valid };
  }
}

// Inicializar limpeza automática quando o módulo for carregado
if (typeof window !== 'undefined') {
  TokenCleanupService.startAutomaticCleanup();
}
