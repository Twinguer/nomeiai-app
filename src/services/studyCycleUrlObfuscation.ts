import { supabase } from '@/integrations/supabase/client';
import { logError, logWarn } from '@/utils/secureLogger';
import { UserStudyService } from './userStudyService';
import { devLog, sanitizeForLog } from '@/utils/productionLogger';

// Serviço para ofuscar URLs de ciclos de estudo e controlar acesso
export class StudyCycleUrlObfuscationService {
  // ✅ SEGURANÇA: Gerar token via RPC no backend (sem expor chaves)
  static async generateStudyCycleToken(cycleId: string, userId: string): Promise<string> {
    try {
      // Verificar se o ciclo existe e pertence ao usuário
      const userStudyData = await UserStudyService.getUserStudyData(userId);
      
      if (!userStudyData || !userStudyData.study_cycles) {
        throw new Error('Dados de estudo do usuário não encontrados');
      }
      
      // Buscar o ciclo específico
      const cycle = userStudyData.study_cycles.find((c: any) => c.id === cycleId);
      
      if (!cycle) {
        throw new Error('Ciclo de estudo não encontrado ou não autorizado');
      }
      
      // Verificar se o ciclo está ativo
      if (!cycle.is_active) {
        throw new Error('Ciclo de estudo não está mais ativo');
      }
      
      // Gerar token seguro via RPC no backend
      // Para study_cycle, armazenamos userId no metadata para validação posterior
      const { data: tokenHash, error } = await supabase.rpc('generate_secure_token', {
        p_entity_type: 'study_cycle',
        p_entity_id: cycleId,
        p_metadata: { user_id: userId },
        p_expires_in_minutes: 1440 // 24 horas
      });
      
      if (error) {
        devLog.error('[generateStudyCycleToken] Erro ao gerar token via RPC:', error);
        throw new Error(`Erro ao gerar token: ${error.message}`);
      }
      
      if (!tokenHash) {
        throw new Error('Token não foi gerado');
      }
      
      if (import.meta.env.DEV) {
        devLog.log('[generateStudyCycleToken] ✅ Token gerado via RPC:', tokenHash.substring(0, 10) + '...');
      }
      
      return tokenHash;
    } catch (error) {
      logError('Failed to generate study cycle token', { cycleId, userId }, 'STUDY_CYCLE_URL_OBFUSCATION');
      throw error;
    }
  }
  
  // ✅ SEGURANÇA: Validar token via RPC no backend (novo sistema)
  static async validateStudyCycleToken(token: string, userId: string): Promise<string | null> {
    try {
      // Log detalhado em desenvolvimento
      if (import.meta.env.DEV) {
        devLog.log('[validateStudyCycleToken] Validando token:', {
          tokenPrefix: token.substring(0, 10) + '...',
          userId: userId
        });
      }
      
      // Tentar novo sistema primeiro (resolve_secure_token)
      const { data: tokenData, error: resolveError } = await supabase.rpc('resolve_secure_token', {
        p_token_hash: token
      });
      
      if (import.meta.env.DEV) {
        devLog.log('[validateStudyCycleToken] Resultado resolve_secure_token:', {
          hasData: !!tokenData,
          hasError: !!resolveError,
          data: tokenData,
          error: resolveError
        });
      }
      
      if (!resolveError && tokenData && tokenData.entity_type === 'study_cycle') {
        const tokenUserId = tokenData.metadata?.user_id;
        if (tokenUserId && tokenUserId !== userId) {
          if (import.meta.env.DEV) {
            devLog.warn('[validateStudyCycleToken] Token pertence a outro usuário:', {
              tokenUserId,
              expectedUserId: userId
            });
          }
          return null;
        }

        const cycleIdFromMeta = tokenData.metadata?.cycle_id;
        if (typeof cycleIdFromMeta === 'string' && cycleIdFromMeta.trim() !== '') {
          if (import.meta.env.DEV) {
            devLog.log('[validateStudyCycleToken] ✅ Token válido (metadata.cycle_id)');
          }
          return cycleIdFromMeta.trim();
        }

        if (tokenData.entity_id) {
          if (import.meta.env.DEV) {
            devLog.log('[validateStudyCycleToken] ✅ Token válido via resolve_secure_token, cycle_id:', tokenData.entity_id);
          }
          return String(tokenData.entity_id);
        }
      }
      
      // Fallback: tentar sistema antigo (compatibilidade com tokens antigos)
      if (import.meta.env.DEV) {
        devLog.warn('[validateStudyCycleToken] Token não encontrado no novo sistema, tentando sistema antigo...');
      }
      
      const { data: secureData, error: secureError } = await supabase.rpc('validate_study_cycle_token_secure', {
        p_token: token,
        p_user_id: userId
      });
      
      if (import.meta.env.DEV) {
        devLog.log('[validateStudyCycleToken] Resultado sistema antigo:', {
          hasData: !!secureData,
          hasError: !!secureError,
          data: secureData,
          error: secureError
        });
      }
      
      if (!secureError && secureData && typeof secureData === 'string' && secureData.trim() !== '') {
        if (import.meta.env.DEV) {
          devLog.log('[validateStudyCycleToken] ✅ Token válido via sistema antigo, cycle_id:', secureData);
        }
        return secureData.trim();
      }
      
      // Token inválido ou expirado
      if (import.meta.env.DEV) {
        devLog.warn('[validateStudyCycleToken] Token inválido ou expirado - ambos os sistemas retornaram null');
      }
      return null;
    } catch (error) {
      devLog.error('[validateStudyCycleToken] Erro geral:', error);
      logError('Failed to validate study cycle token', { token: token.substring(0, 10) + '...', userId }, 'STUDY_CYCLE_URL_OBFUSCATION');
      return null;
    }
  }
  
  // ✅ REMOVIDO: storeToken não é mais necessário
  // Tokens são armazenados no backend via RPC generate_secure_token
  
  // Gerar URL segura para ciclo de estudo
  static async generateSecureStudyCycleUrl(cycleId: string, userId: string, action: 'view' | 'edit' | 'session' | 'cronograma' | 'timer' | 'estatisticas' = 'view'): Promise<string> {
    try {
      const token = await this.generateStudyCycleToken(cycleId, userId);
      const secureUrl = `/estudos/${action}/${token}`;
      return secureUrl;
    } catch (error) {
      logError('Failed to generate secure study cycle URL', { cycleId, userId, action }, 'STUDY_CYCLE_URL_OBFUSCATION');
      return `/error?message=Failed to generate secure URL`;
    }
  }
  
  // Gerar URL segura para cronograma
  static async generateSecureCronogramaUrl(cycleId: string, userId: string): Promise<string> {
    return this.generateSecureStudyCycleUrl(cycleId, userId, 'cronograma');
  }
  
  // Gerar URL segura para timer
  static async generateSecureTimerUrl(cycleId: string, userId: string): Promise<string> {
    return this.generateSecureStudyCycleUrl(cycleId, userId, 'timer');
  }
  
  // Gerar URL segura para estatísticas
  static async generateSecureEstatisticasUrl(cycleId: string, userId: string): Promise<string> {
    return this.generateSecureStudyCycleUrl(cycleId, userId, 'estatisticas');
  }
  
  // Gerar URL segura para sessão de estudo
  static async generateSecureSessaoUrl(cycleId: string, userId: string): Promise<string> {
    return this.generateSecureStudyCycleUrl(cycleId, userId, 'session');
  }
  
  // Validar URL segura e retornar ID do ciclo
  static async validateSecureStudyCycleUrl(token: string, userId: string): Promise<string | null> {
    try {
      return await this.validateStudyCycleToken(token, userId);
    } catch (error) {
      logError('Failed to validate secure study cycle URL', { token: token.substring(0, 10) + '...', userId }, 'STUDY_CYCLE_URL_OBFUSCATION');
      return null;
    }
  }
}
