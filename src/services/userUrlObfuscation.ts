import { supabase } from '@/integrations/supabase/client';
import { logError, logWarn } from '@/utils/secureLogger';
import { devLog, sanitizeForLog } from '@/utils/productionLogger';

// Serviço para ofuscar URLs de usuários e controlar acesso
export class UserUrlObfuscationService {
  // ✅ SEGURANÇA: Gerar token via RPC no backend (sem expor chaves)
  static async generateUserToken(userId: string): Promise<string> {
    try {
      // Gerar token seguro via RPC no backend
      const { data: tokenHash, error } = await supabase.rpc('generate_secure_token', {
        p_entity_type: 'user',
        p_entity_id: userId,
        p_metadata: {},
        p_expires_in_minutes: 1440 // 24 horas
      });
      
      if (error) {
        devLog.error('[generateUserToken] Erro ao gerar token via RPC:', error);
        throw new Error(`Erro ao gerar token: ${error.message}`);
      }
      
      if (!tokenHash) {
        throw new Error('Token não foi gerado');
      }
      
      if (import.meta.env.DEV) {
        devLog.log('[generateUserToken] ✅ Token gerado via RPC:', tokenHash.substring(0, 10) + '...');
      }
      
      return tokenHash;
    } catch (error) {
      logError('Failed to generate user token', { userId }, 'URL_OBFUSCATION');
      throw error;
    }
  }
  
  // ✅ SEGURANÇA: Validar token via RPC no backend (novo sistema)
  static async validateUserToken(token: string): Promise<string | null> {
    try {
      // Tentar novo sistema primeiro (resolve_secure_token)
      const { data: tokenData, error: resolveError } = await supabase.rpc('resolve_secure_token', {
        p_token_hash: token
      });
      
      if (!resolveError && tokenData && tokenData.entity_type === 'user' && tokenData.entity_id) {
        if (import.meta.env.DEV) {
          devLog.log('[validateUserToken] ✅ Token válido via resolve_secure_token, user_id:', tokenData.entity_id);
        }
        return tokenData.entity_id;
      }
      
      // Fallback: tentar sistema antigo (compatibilidade com tokens antigos)
      if (import.meta.env.DEV) {
        devLog.warn('[validateUserToken] Token não encontrado no novo sistema, tentando sistema antigo...');
      }
      
      const { data: secureData, error: secureError } = await supabase.rpc('validate_user_token_secure', {
        p_token: token
      });
      
      if (!secureError && secureData && typeof secureData === 'string' && secureData.trim() !== '') {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (uuidRegex.test(secureData.trim())) {
          if (import.meta.env.DEV) {
            devLog.log('[validateUserToken] ✅ Token válido via sistema antigo, user_id:', secureData);
          }
          return secureData.trim();
        }
      }
      
      // Token inválido ou expirado
      if (import.meta.env.DEV) {
        devLog.warn('[validateUserToken] Token inválido ou expirado');
      }
      return null;
    } catch (error) {
      logError('Failed to validate user token', { token: token?.substring(0, 10) + '...' }, 'URL_OBFUSCATION');
      return null;
    }
  }
  
  // ✅ REMOVIDO: storeToken não é mais necessário
  // Tokens são armazenados no backend via RPC generate_secure_token
  
  // Gerar URL segura para usuário
  static async generateSecureUserUrl(userId: string, action: 'profile' | 'followers' | 'following' = 'profile'): Promise<string> {
    const token = await this.generateUserToken(userId);
    return `/usuario/${action}/${token}`;
  }
  
  // Gerar URL segura para perfil
  static async generateSecureProfileUrl(userId: string): Promise<string> {
    return this.generateSecureUserUrl(userId, 'profile');
  }
  
  // Gerar URL segura para seguidores
  static async generateSecureFollowersUrl(userId: string): Promise<string> {
    return this.generateSecureUserUrl(userId, 'followers');
  }
  
  // Gerar URL segura para seguindo
  static async generateSecureFollowingUrl(userId: string): Promise<string> {
    return this.generateSecureUserUrl(userId, 'following');
  }
}

// Hook para usar o serviço de ofuscação de usuários
export const useSecureUserUrls = () => {
  const generateSecureUserUrl = async (userId: string, action: 'profile' | 'followers' | 'following' = 'profile') => {
    return await UserUrlObfuscationService.generateSecureUserUrl(userId, action);
  };
  
  const validateUserToken = async (token: string) => {
    return await UserUrlObfuscationService.validateUserToken(token);
  };
  
  return {
    generateSecureUserUrl,
    validateUserToken
  };
};
