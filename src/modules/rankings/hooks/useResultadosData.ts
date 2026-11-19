// @ts-nocheck
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchConcursoById } from '@/services/concursoService';
import { fetchUserRankings } from '@/modules/rankings/services/rankingService';
import { useAuth } from '@/hooks/useAuth';
import type { Ranking } from '@/modules/rankings/services/rankingService';
import { supabase } from '@/integrations/supabase/client';
import { useEffect, useState } from 'react';
import { logger } from '@/utils/logger';
import { devLog } from '@/utils/productionLogger';
import { isParticipatingInConcurso } from '@/modules/rankings/domain/rankingAccess';
import { refreshClassificationData } from '@/modules/rankings/domain/rankingRefresh';

export type ResultadosDataOptions = {
  allowUrlFallback?: boolean;
};

export function useResultadosData(concursoId?: string, options: ResultadosDataOptions = {}) {
  const { allowUrlFallback = true } = options;
  const { id: urlId } = useParams() as { id?: string };
  const resolvedId = concursoId ?? (allowUrlFallback ? urlId : undefined);
  const { user } = useAuth();
  const isAuthenticated = !!user;

  const id = resolvedId;

  const [isRecalculating, setIsRecalculating] = useState(false);
  const [recalculationProgress, setRecalculationProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);

  const { data: concurso, isLoading: isLoadingConcurso } = useQuery({
    queryKey: ['concurso', id],
    queryFn: () => fetchConcursoById(id),
    staleTime: 10000,
    enabled: !!id,
  });

  const { data: creatorInfo, isLoading: isLoadingCreator } = useQuery({
    queryKey: ['creator', concurso?.created_by_user_id],
    queryFn: async () => {
      if (!concurso?.created_by_user_id) {
        return null;
      }

      const { data, error } = await supabase
        .from('users_profiles')
        .select('name')
        .eq('id', concurso.created_by_user_id)
        .single();

      if (error) {
        logger.error('Error fetching creator info', 'USE_RESULTADOS_DATA', error);
        return null;
      }

      return data;
    },
    enabled: !!concurso?.created_by_user_id && !!concurso,
    staleTime: 300000,
  });

  const {
    data: rankings = [],
    isLoading: isLoadingRankings,
    refetch: refetchRankings,
    isRefetching,
  } = useQuery({
    queryKey: ['rankings-v3', 'v2-tiebreaker-by-date', id],
    queryFn: async () => {
      if (!id) {
        return [];
      }
      try {
        const result = await fetchUserRankings(id, undefined, 0, 100);
        devLog.debug('[useResultadosData] Rankings buscados com sucesso', {
          count: result.length,
        });
        return result;
      } catch (error) {
        devLog.error('[useResultadosData] Erro ao chamar fetchUserRankings:', error);
        throw error;
      }
    },
    refetchOnWindowFocus: false,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnMount: true,
    enabled: !!id,
    onError: (error) => {
      devLog.error('[useResultadosData] Erro na query:', error);
    },
  });

  const {
    data: participantCount = 0,
    isLoading: isLoadingCount,
    refetch: refetchCount,
  } = useQuery({
    queryKey: ['participant-count-v2', id],
    queryFn: async () => {
      const { data: countData, error: rpcError } = await supabase.rpc('count_concurso_participants', {
        concurso_id: id,
      });

      if (!rpcError && countData !== null && countData !== undefined) {
        return countData as number;
      }

      const { data, error } = await supabase.from('user_rankings').select('consolidated_data');

      if (error) {
        logger.error('Error fetching participant count', 'USE_RESULTADOS_DATA', error);
        return 0;
      }

      let count = 0;
      if (data) {
        data.forEach((userRanking) => {
          if (userRanking.consolidated_data?.rankings) {
            Object.values(userRanking.consolidated_data.rankings).forEach((rankingData: { concurso_id?: string }) => {
              if (rankingData.concurso_id === id) {
                count++;
              }
            });
          }
        });
      }

      return count;
    },
    staleTime: 30000,
  });

  const { data: userParticipationStatus, isLoading: isCheckingParticipation } = useQuery({
    queryKey: ['user-participation-v2', id, user?.id],
    queryFn: async () => {
      if (!user || !id) {
        return { isParticipating: false };
      }

      const { data, error } = await supabase
        .from('user_rankings')
        .select('consolidated_data')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        logger.error('Error checking participation', 'USE_RESULTADOS_DATA', error);
        return { isParticipating: false };
      }

      const isParticipating = isParticipatingInConcurso(data?.consolidated_data, id);

      let rankingId: string | null = null;
      if (isParticipating && data?.consolidated_data?.rankings) {
        for (const [rankingIdKey, rankingData] of Object.entries(data.consolidated_data.rankings)) {
          if ((rankingData as { concurso_id?: string }).concurso_id === id) {
            rankingId = rankingIdKey;
            break;
          }
        }
      }

      return { isParticipating, rankingId };
    },
    enabled: !!user && !!id,
    staleTime: 10000,
  });

  useEffect(() => {
    if (!id) return;

    const channel = supabase
      .channel('rankings-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_rankings',
          filter: `concurso_id=eq.${id}`,
        },
        () => {
          refetchRankings();
          refetchCount();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, refetchRankings, refetchCount]);

  useEffect(() => {
    if (!id || concurso?.gabarito_status !== 'consensus') {
      return;
    }

    let cancelled = false;

    const runConsensusRecalc = async () => {
      const { data, error } = await supabase.rpc('process_consensus_recalc_pending', {
        p_debounce_seconds: 45,
      });

      if (cancelled || error) {
        return;
      }

      if ((data as { processed?: number })?.processed > 0) {
        refetchRankings();
        refetchCount();
      }
    };

    void runConsensusRecalc();

    return () => {
      cancelled = true;
    };
  }, [id, concurso?.gabarito_status, concurso?.recalc_pending_at, concurso?.provisional_version, refetchRankings, refetchCount]);

  const userRanking = isAuthenticated ? rankings.find((r: Ranking) => r.userId === user?.id) : null;

  const isLoading = isLoadingConcurso || isLoadingCount || isLoadingCreator || isCheckingParticipation;

  const refreshData = async () => {
    logger.info('Manual refresh initiated', 'USE_RESULTADOS_DATA', { concursoId: id });

    if (!id) {
      return { success: false, error: 'ID do concurso não fornecido' };
    }

    if (isRecalculating) {
      logger.warn('Recalculation already in progress', 'USE_RESULTADOS_DATA');
      return { success: false, error: 'Recálculo já em andamento. Aguarde a conclusão.' };
    }

    try {
      setIsRecalculating(true);
      setRecalculationProgress({ current: 0, total: 0 });

      return await refreshClassificationData(id, {
        onProgress: (current, total) => setRecalculationProgress({ current, total }),
        refetchRankings,
        refetchCount,
      });
    } finally {
      setIsRecalculating(false);
      setRecalculationProgress(null);
    }
  };

  return {
    concurso,
    rankings,
    participantCount,
    userRanking,
    isLoading,
    isRefetching,
    user,
    refreshData,
    refetchRankings,
    refetchCount,
    creatorName: creatorInfo?.name || (concurso?.is_admin_created ? 'Administrador' : 'Usuário'),
    inscritos: concurso?.inscritos || 0,
    isParticipating: userParticipationStatus?.isParticipating || false,
    userRankingId: userParticipationStatus?.rankingId,
    isRecalculating,
    recalculationProgress,
  };
}
