import { supabase } from '@/integrations/supabase/client';
import { devLog, sanitizeForLog } from '@/utils/productionLogger';
import { logError } from '@/utils/secureLogger';
import { checkIsPlatformAdmin } from '@/utils/adminRole';

export class EditUrlObfuscationService {
  /**
   * ✅ SEGURANÇA: Gera token seguro via RPC no backend (sem expor chaves)
   * Migrado de btoa() para sistema seguro de tokens
   */
  static async generateEditToken(concursoId: string, userId: string): Promise<string> {
    try {
      // Verificar se o usuário tem permissão para editar este concurso
      const { data: concurso, error } = await supabase
        .from('concursos')
        .select('id, created_by_user_id')
        .eq('id', concursoId)
        .single();

      if (error) {
        throw new Error(`Erro ao buscar concurso: ${error.message}`);
      }

      if (!concurso) {
        throw new Error('Concurso não encontrado');
      }

      const isCreator = concurso.created_by_user_id === userId;
      const isAdmin = await checkIsPlatformAdmin();

      if (!isCreator && !isAdmin) {
        throw new Error('Usuário não tem permissão para editar este concurso');
      }

      // ✅ Gerar token seguro via RPC no backend
      const { data: tokenHash, error: tokenError } = await supabase.rpc('generate_secure_token', {
        p_entity_type: 'edit',
        p_entity_id: concursoId,
        p_metadata: { user_id: userId },
        p_expires_in_minutes: 1440 // 24 horas
      });

      if (tokenError) {
        devLog.error('[generateEditToken] Erro ao gerar token via RPC:', tokenError);
        throw new Error(`Erro ao gerar token: ${tokenError.message}`);
      }

      if (!tokenHash) {
        throw new Error('Token não foi gerado');
      }

      if (import.meta.env.DEV) {
        devLog.log('[generateEditToken] ✅ Token gerado via RPC:', tokenHash.substring(0, 10) + '...');
      }

      return tokenHash;
    } catch (error) {
      logError('Failed to generate edit token', { concursoId, userId }, 'EDIT_URL_OBFUSCATION');
      throw error;
    }
  }

  /**
   * ✅ SEGURANÇA: Valida token via RPC no backend (novo sistema)
   * Migrado de atob() para sistema seguro de tokens
   */
  static async validateEditToken(token: string, userId: string): Promise<string | null> {
    try {
      // Tentar novo sistema primeiro (resolve_secure_token)
      const { data: tokenData, error: resolveError } = await supabase.rpc('resolve_secure_token', {
        p_token_hash: token
      });

      if (!resolveError && tokenData && tokenData.entity_type === 'edit' && tokenData.entity_id) {
        // Validar que o token pertence ao usuário correto
        const tokenUserId = tokenData.metadata?.user_id;
        if (tokenUserId && tokenUserId !== userId) {
          if (import.meta.env.DEV) {
            devLog.warn('[validateEditToken] Token pertence a outro usuário:', {
              tokenUserId,
              expectedUserId: userId
            });
          }
          return null;
        }

        // Verificar se o concurso ainda existe e o usuário ainda tem permissão
        const { data: concurso, error: concursoError } = await supabase
          .from('concursos')
          .select('id, created_by_user_id')
          .eq('id', tokenData.entity_id)
          .single();

        if (concursoError || !concurso) {
          if (import.meta.env.DEV) {
            devLog.warn('[validateEditToken] Concurso não encontrado ou sem permissão');
          }
          return null;
        }

        const isCreator = concurso.created_by_user_id === userId;
        const isAdmin = await checkIsPlatformAdmin();
        if (!isCreator && !isAdmin) {
          if (import.meta.env.DEV) {
            devLog.warn('[validateEditToken] Concurso não encontrado ou sem permissão');
          }
          return null;
        }

        if (import.meta.env.DEV) {
          devLog.log('[validateEditToken] ✅ Token válido via resolve_secure_token, concurso_id:', tokenData.entity_id);
        }
        return tokenData.entity_id;
      }

      // Fallback: tentar sistema antigo (compatibilidade com tokens antigos)
      // Tokens antigos tinham prefixo 'edit_' e eram base64
      if (token.startsWith('edit_')) {
        if (import.meta.env.DEV) {
          devLog.warn('[validateEditToken] Token antigo detectado, tentando decodificar...');
        }
        
        try {
          const encodedToken = token.substring(5); // Remove 'edit_'
          const tokenString = atob(encodedToken);
          const oldTokenData = JSON.parse(tokenString);

          // Verificar se o token não expirou (24 horas)
          const now = Date.now();
          const tokenAge = now - oldTokenData.timestamp;
          const maxAge = 24 * 60 * 60 * 1000; // 24 horas

          if (tokenAge > maxAge) {
            return null;
          }

          // Verificar se o usuário é o mesmo que gerou o token
          if (oldTokenData.userId !== userId) {
            return null;
          }

          // Verificar se o concurso ainda existe e o usuário ainda tem permissão
          const { data: concurso, error: concursoError } = await supabase
            .from('concursos')
            .select('id, created_by_user_id')
            .eq('id', oldTokenData.concursoId)
            .single();

          if (concursoError || !concurso) {
            return null;
          }

          const isCreator = concurso.created_by_user_id === userId;
          const isAdmin = await checkIsPlatformAdmin();
          if (!isCreator && !isAdmin) {
            return null;
          }

          if (import.meta.env.DEV) {
            devLog.log('[validateEditToken] ✅ Token antigo válido, concurso_id:', oldTokenData.concursoId);
          }
          return oldTokenData.concursoId;
        } catch (oldTokenError) {
          // Token antigo inválido
          return null;
        }
      }

      // Token inválido ou expirado
      if (import.meta.env.DEV) {
        devLog.warn('[validateEditToken] Token inválido ou expirado');
      }
      return null;
    } catch (error) {
      devLog.error('[validateEditToken] Erro geral:', error);
      logError('Failed to validate edit token', { token: token.substring(0, 10) + '...', userId }, 'EDIT_URL_OBFUSCATION');
      return null;
    }
  }

  /**
   * Gera URL segura para edição de ranking
   */
  static async generateEditUrl(concursoId: string, userId: string): Promise<string> {
    const token = await this.generateEditToken(concursoId, userId);
    return `/criar-ranking?edit=${token}`;
  }
}

export const { generateEditToken, validateEditToken, generateEditUrl } = EditUrlObfuscationService;
