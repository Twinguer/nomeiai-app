import { supabase } from '@/integrations/supabase/client';
import { recalculateUserScore } from '@/integrations/supabase/rankings/rankingMutations';
import { logger } from '@/utils/logger';
import { devLog } from '@/utils/productionLogger';

export type RefreshClassificationResult =
  | { success: true; participantsRecalculated: number }
  | { success: false; error: string };

export type RefreshProgressCallback = (current: number, total: number) => void;

/**
 * Recalcula scores de todos os participantes do concurso e dispara refetch.
 * Mantém lock e progresso no hook chamador.
 */
export async function refreshClassificationData(
  concursoId: string,
  options: {
    onProgress?: RefreshProgressCallback;
    refetchRankings: () => Promise<unknown>;
    refetchCount: () => Promise<unknown>;
  },
): Promise<RefreshClassificationResult> {
  if (!concursoId) {
    devLog.error('[rankingRefresh] ID do concurso não fornecido');
    return { success: false, error: 'ID do concurso não fornecido' };
  }

  try {
    const { data: allUserRankings, error: fetchError } = await supabase
      .from('user_rankings')
      .select('user_id, consolidated_data');

    if (fetchError) {
      throw new Error(`Erro ao buscar participantes: ${fetchError.message}`);
    }

    const participants: string[] = [];

    allUserRankings?.forEach((ur) => {
      const rankings = ur.consolidated_data?.rankings || {};
      for (const rankingData of Object.values(rankings)) {
        if ((rankingData as { concurso_id?: string }).concurso_id === concursoId) {
          participants.push(ur.user_id);
          break;
        }
      }
    });

    options.onProgress?.(0, participants.length);

    if (participants.length > 0) {
      const batchSize = 50;
      let processedCount = 0;

      for (let i = 0; i < participants.length; i += batchSize) {
        const batch = participants.slice(i, i + batchSize);
        const results = await Promise.allSettled(
          batch.map((userId) => recalculateUserScore(userId, concursoId)),
        );
        processedCount += results.filter((r) => r.status === 'fulfilled').length;
        options.onProgress?.(processedCount, participants.length);
      }
    }

    await Promise.all([options.refetchRankings(), options.refetchCount()]);

    logger.info('Classification refreshed', 'RANKING_REFRESH', {
      concursoId,
      participantsRecalculated: participants.length,
    });

    return { success: true, participantsRecalculated: participants.length };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('Error refreshing classification', 'RANKING_REFRESH', error);
    return { success: false, error: message };
  }
}
