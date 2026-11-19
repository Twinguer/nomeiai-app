import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { devLog, sanitizeForLog } from '@/utils/productionLogger';

interface EditLimitsResult {
  allowed: boolean;
  reason?: string;
  is_pro?: boolean;
  current_count?: number;
  max_allowed?: number;
  remaining_edits?: number | null;
  message?: string;
  isLoading: boolean;
}

/**
 * Hook para verificar se um usuário pode editar um cartão de respostas
 * Usa a função RPC do backend para garantir validação consistente
 */
export const useEditLimits = (rankingId?: string, currentEditCount?: number) => {
  const { user } = useAuth();

  const { data, isLoading, error } = useQuery({
    queryKey: ['edit-limits', user?.id, rankingId, currentEditCount],
    queryFn: async () => {
      if (!user?.id || !rankingId || currentEditCount === undefined) {
        return {
          allowed: false,
          reason: 'missing_data',
        };
      }

      const { data, error } = await supabase.rpc('check_free_user_edit_limits', {
        p_user_id: user.id,
        p_ranking_id: rankingId,
        p_current_edit_count: currentEditCount,
      });

      if (error) {
        devLog.error('[useEditLimits] Erro ao verificar limites de edição:', error);
        throw error;
      }

      return data as Omit<EditLimitsResult, 'isLoading'>;
    },
    enabled: !!user?.id && !!rankingId && currentEditCount !== undefined,
    retry: 1,
  });

  return {
    ...data,
    isLoading,
    error,
  } as EditLimitsResult;
};
