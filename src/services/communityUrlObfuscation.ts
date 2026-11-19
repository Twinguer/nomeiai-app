import { supabase } from '@/integrations/supabase/client';
import { logError, logWarn } from '@/utils/secureLogger';
import { devLog, sanitizeForLog } from '@/utils/productionLogger';

// Serviço para ofuscar URLs da comunidade e controlar acesso
export class CommunityUrlObfuscationService {
  // ✅ SEGURANÇA: Gerar token via RPC no backend (sem expor chaves)
  static async generateCommunityToken(userId: string, action: 'followers' | 'following' | 'profile'): Promise<string> {
    try {
      // Gerar token seguro via RPC no backend
      const { data: tokenHash, error } = await supabase.rpc('generate_secure_token', {
        p_entity_type: 'community',
        p_entity_id: userId,
        p_metadata: { action: action },
        p_expires_in_minutes: 1440 // 24 horas
      });
      
      if (error) {
        devLog.error('[generateCommunityToken] Erro ao gerar token via RPC:', error);
        throw new Error(`Erro ao gerar token: ${error.message}`);
      }
      
      if (!tokenHash) {
        throw new Error('Token não foi gerado');
      }
      
      if (import.meta.env.DEV) {
        devLog.log('[generateCommunityToken] ✅ Token gerado via RPC:', tokenHash.substring(0, 10) + '...');
      }
      
      return tokenHash;
    } catch (error) {
      logError('Failed to generate community token', { userId, action }, 'COMMUNITY_URL_OBFUSCATION');
      throw error;
    }
  }
  
  // ✅ SEGURANÇA: Validar token via RPC no backend (novo sistema)
  static async validateCommunityToken(token: string): Promise<{userId: string, action: string} | null> {
    try {
      // Tentar novo sistema primeiro (resolve_secure_token)
      const { data: tokenData, error: resolveError } = await supabase.rpc('resolve_secure_token', {
        p_token_hash: token
      });
      
      if (!resolveError && tokenData && tokenData.entity_type === 'community' && tokenData.entity_id) {
        const action = tokenData.action || tokenData.metadata?.action || 'profile';
        if (import.meta.env.DEV) {
          devLog.log('[validateCommunityToken] ✅ Token válido via resolve_secure_token, user_id:', tokenData.entity_id, 'action:', action);
        }
        return {
          userId: tokenData.entity_id,
          action: action
        };
      }
      
      // Fallback: tentar sistema antigo (compatibilidade com tokens antigos)
      if (import.meta.env.DEV) {
        devLog.warn('[validateCommunityToken] Token não encontrado no novo sistema, tentando sistema antigo...');
      }
      
      const { data: secureData, error: secureError } = await supabase.rpc('validate_community_token_secure', {
        p_token: token
      });
      
      if (!secureError && secureData && typeof secureData === 'object' && secureData !== null) {
        const userId = secureData.user_id || secureData.userId;
        const action = secureData.action || 'profile';
        
        if (userId && typeof userId === 'string') {
          if (import.meta.env.DEV) {
            devLog.log('[validateCommunityToken] ✅ Token válido via sistema antigo, user_id:', userId, 'action:', action);
          }
          return {
            userId: userId,
            action: action
          };
        }
      }
      
      // Token inválido ou expirado
      if (import.meta.env.DEV) {
        devLog.warn('[validateCommunityToken] Token inválido ou expirado');
      }
      return null;
    } catch (error) {
      logError('Failed to validate community token', { token: token.substring(0, 10) + '...' }, 'COMMUNITY_URL_OBFUSCATION');
      return null;
    }
  }
  
  // ✅ REMOVIDO: storeToken não é mais necessário
  // Tokens são armazenados no backend via RPC generate_secure_token
  
  // Gerar URL segura para perfil
  static async generateSecureProfileUrl(userId: string): Promise<string> {
    const token = await this.generateCommunityToken(userId, 'profile');
    return `/usuario/profile/${token}`;
  }
  
  // Gerar URL segura para seguidores
  static async generateSecureFollowersUrl(userId: string): Promise<string> {
    const token = await this.generateCommunityToken(userId, 'followers');
    return `/usuario/followers/${token}`;
  }
  
  // Gerar URL segura para seguindo
  static async generateSecureFollowingUrl(userId: string): Promise<string> {
    const token = await this.generateCommunityToken(userId, 'following');
    return `/usuario/following/${token}`;
  }
  
  // Gerar URL segura genérica
  static async generateSecureCommunityUrl(userId: string, action: 'followers' | 'following' | 'profile'): Promise<string> {
    const token = await this.generateCommunityToken(userId, action);
    return `/usuario/${action}/${token}`;
  }
}

// Hook para usar o serviço de ofuscação da comunidade
export const useSecureCommunityUrls = () => {
  const generateSecureUrl = async (userId: string, action: 'followers' | 'following' | 'profile') => {
    return await CommunityUrlObfuscationService.generateSecureCommunityUrl(userId, action);
  };
  
  const validateToken = async (token: string) => {
    return await CommunityUrlObfuscationService.validateCommunityToken(token);
  };
  
  return {
    generateSecureUrl,
    validateToken
  };
};
