import { supabase } from '@/integrations/supabase/client';
import { devLog, sanitizeForLog } from '@/utils/productionLogger';

// Serviço para ofuscar URLs e controlar acesso
export class UrlObfuscationService {
  // ✅ SEGURANÇA: Gerar token via RPC no backend (sem expor chaves)
  static async generateConcursoToken(concursoId: string): Promise<string> {
    try {
      // Verificar se o concurso existe e está ativo (validação no backend também)
      const { data: concurso, error: checkError } = await supabase
        .from('concursos')
        .select('id, titulo, status')
        .eq('id', concursoId)
        .single();
      
      if (checkError || !concurso) {
        throw new Error('Concurso não encontrado');
      }
      
      // Verificar se o concurso está ativo (não finalizado ou suspenso)
      if (concurso.status === 'Finalizado' || concurso.status === 'Suspenso') {
        throw new Error('Concurso não está mais ativo');
      }
      
      // Gerar token seguro via RPC no backend
      const { data: tokenHash, error } = await supabase.rpc('generate_secure_token', {
        p_entity_type: 'concurso',
        p_entity_id: concursoId,
        p_metadata: {},
        p_expires_in_minutes: 1440 // 24 horas
      });
      
      if (error) {
        devLog.error('[generateConcursoToken] Erro ao gerar token via RPC:', error);
        throw new Error(`Erro ao gerar token: ${error.message}`);
      }
      
      if (!tokenHash) {
        throw new Error('Token não foi gerado');
      }
      
      if (import.meta.env.DEV) {
        devLog.log('[generateConcursoToken] ✅ Token gerado via RPC:', tokenHash.substring(0, 10) + '...');
      }
      
      return tokenHash;
    } catch (error) {
      devLog.error('Erro ao gerar token de concurso:', error);
      throw error;
    }
  }
  
  // ✅ SEGURANÇA: Validar token via RPC no backend (novo sistema)
  static async validateConcursoToken(token: string): Promise<string | null> {
    try {
      // Tentar novo sistema primeiro (resolve_secure_token)
      const { data: tokenData, error: resolveError } = await supabase.rpc('resolve_secure_token', {
        p_token_hash: token
      });
      
      if (!resolveError && tokenData && tokenData.entity_type === 'concurso' && tokenData.entity_id) {
        if (import.meta.env.DEV) {
          devLog.log('[validateConcursoToken] ✅ Token válido via resolve_secure_token, concurso_id:', tokenData.entity_id);
        }
        return tokenData.entity_id;
      }
      
      // Fallback: tentar sistema antigo (compatibilidade com tokens antigos)
      if (import.meta.env.DEV) {
        devLog.warn('[validateConcursoToken] Token não encontrado no novo sistema, tentando sistema antigo...');
      }
      
      const { data, error } = await supabase.rpc('validate_concurso_token', {
        p_token: token
      });
      
      if (!error && data) {
        if (import.meta.env.DEV) {
          devLog.log('[validateConcursoToken] ✅ Token válido via sistema antigo, concurso_id:', data);
        }
        return data;
      }
      
      // Token inválido ou expirado
      if (import.meta.env.DEV) {
        devLog.warn('[validateConcursoToken] Token inválido ou expirado');
      }
      return null;
    } catch (error) {
      devLog.error('Erro ao validar token:', error);
      return null;
    }
  }
  
  // ✅ REMOVIDO: storeToken não é mais necessário
  // Tokens são armazenados no backend via RPC generate_secure_token
  
  // Gerar URL segura para concurso
  static async generateSecureConcursoUrl(concursoId: string, action: 'resultados' | 'participar' | 'ranking' | 'estatisticas' | 'historico' = 'resultados'): Promise<string> {
    const token = await this.generateConcursoToken(concursoId);
    return `/concurso/${action}/${token}`;
  }
  
  // Gerar URL segura para resultados
  static async generateSecureResultadosUrl(concursoId: string): Promise<string> {
    return this.generateSecureConcursoUrl(concursoId, 'resultados');
  }
  
  // Gerar URL segura para participação
  static async generateSecureParticiparUrl(concursoId: string): Promise<string> {
    return this.generateSecureConcursoUrl(concursoId, 'participar');
  }
  
  // Gerar URL segura para ranking
  static async generateSecureRankingUrl(concursoId: string): Promise<string> {
    return this.generateSecureConcursoUrl(concursoId, 'ranking');
  }
  
  // Gerar URL segura para página de cargos (pre-classificacao)
  static async generateSecureCargosUrl(concursoId: string, state?: string): Promise<string> {
    const token = await this.generateConcursoToken(concursoId);
    const stateParam = state ? `?state=${encodeURIComponent(state)}` : '';
    return `/pre-classificacao/${token}/cargos${stateParam}`;
  }
  
  // Gerar URL segura para estatísticas
  static async generateSecureEstatisticasUrl(concursoId: string): Promise<string> {
    return this.generateSecureConcursoUrl(concursoId, 'estatisticas');
  }
  
  // Gerar URL segura para histórico
  static async generateSecureHistoricoUrl(concursoId: string): Promise<string> {
    return this.generateSecureConcursoUrl(concursoId, 'historico');
  }
}

// Hook para usar o serviço de ofuscação
export const useSecureUrls = () => {
  const generateSecureUrl = async (concursoId: string, action: 'resultados' | 'participar' | 'ranking' | 'estatisticas' | 'historico' = 'resultados') => {
    return await UrlObfuscationService.generateSecureConcursoUrl(concursoId, action);
  };
  
  const validateToken = async (token: string) => {
    return await UrlObfuscationService.validateConcursoToken(token);
  };
  
  const generateResultadosUrl = async (concursoId: string) => {
    return await UrlObfuscationService.generateSecureResultadosUrl(concursoId);
  };
  
  const generateParticiparUrl = async (concursoId: string) => {
    return await UrlObfuscationService.generateSecureParticiparUrl(concursoId);
  };
  
  const generateRankingUrl = async (concursoId: string) => {
    return await UrlObfuscationService.generateSecureRankingUrl(concursoId);
  };
  
  const generateEstatisticasUrl = async (concursoId: string) => {
    return await UrlObfuscationService.generateSecureEstatisticasUrl(concursoId);
  };
  
  const generateHistoricoUrl = async (concursoId: string) => {
    return await UrlObfuscationService.generateSecureHistoricoUrl(concursoId);
  };
  
  return {
    generateSecureUrl,
    validateToken,
    generateResultadosUrl,
    generateParticiparUrl,
    generateRankingUrl,
    generateEstatisticasUrl,
    generateHistoricoUrl
  };
};
