import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { devLog, sanitizeForLog } from '@/utils/productionLogger';

interface ParticipationLimitsResult {
  allowed: boolean;
  reason?: string;
  is_pro?: boolean;
  is_creator?: boolean;
  current_count?: number;
  max_allowed?: number;
  message?: string;
  isLoading: boolean;
}

/**
 * Hook para verificar se um usuário pode participar de um ranking específico
 * Usa a função RPC do backend para garantir validação consistente
 */
export const useRankingParticipationLimits = (concursoId?: string) => {
  const { user } = useAuth();

  const { data, isLoading, error } = useQuery({
    queryKey: ['ranking-participation-limits', user?.id, concursoId],
    queryFn: async () => {
      if (!user?.id || !concursoId) {
        return {
          allowed: false,
          reason: 'missing_data',
        };
      }

      const { data, error } = await supabase.rpc('check_free_user_ranking_limits', {
        p_user_id: user.id,
        p_concurso_id: concursoId,
      });

      if (error) {
        devLog.error('[useRankingParticipationLimits] Erro ao verificar limites:', error);
        throw error;
      }

      return data as Omit<ParticipationLimitsResult, 'isLoading'>;
    },
    enabled: !!user?.id && !!concursoId,
    retry: 1,
  });

  return {
    ...data,
    isLoading,
    error,
  } as ParticipationLimitsResult;
};
