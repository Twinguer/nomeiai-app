import { supabase } from '@/integrations/supabase/client';
import { devLog } from '@/utils/productionLogger';
import { getProfileRankingStatus } from './rankingProfilePosition';

export type UserRankingSummary = {
  concursoId: string;
  concursoTitle: string;
  position: number | null;
  score: number;
  isClassified: boolean;
};

type PublicRankingRpcItem = {
  concurso_id: string;
  concurso_title: string;
  score: number;
};

/** Perfil público: resumo via RPC (respeita showPublicRankings no servidor). */
export async function fetchPublicProfileRankingSummaries(
  userId: string,
  options?: { includePosition?: boolean }
): Promise<UserRankingSummary[]> {
  try {
    const { data, error } = await supabase.rpc('get_public_profile_ranking_summaries', {
      p_user_id: userId,
    });

    if (error) throw error;

    const payload = data as { success?: boolean; data?: PublicRankingRpcItem[] };
    if (!payload?.success || !Array.isArray(payload.data) || payload.data.length === 0) {
      return [];
    }

    const includePosition = options?.includePosition ?? false;

    const results = await Promise.all(
      payload.data.map(async (item) => {
        let position: number | null = null;
        let isClassified = false;

        if (includePosition) {
          const status = await getProfileRankingStatus(item.concurso_id, userId);
          position = status.isEliminated ? null : status.position;
          isClassified = !status.isEliminated && status.position !== null;
        }

        return {
          concursoId: item.concurso_id,
          concursoTitle: item.concurso_title,
          position,
          score: Number(item.score) || 0,
          isClassified,
        } satisfies UserRankingSummary;
      })
    );

    return results;
  } catch (error) {
    devLog.error('fetchPublicProfileRankingSummaries failed', error);
    return [];
  }
}

export async function fetchUserRankingSummaries(userId: string): Promise<UserRankingSummary[]> {
  try {
    const { data, error } = await supabase
      .from('user_rankings')
      .select('user_id, consolidated_data')
      .eq('user_id', userId);

    if (error || !data?.length) return [];

    const userRanking = data[0];
    const concursoIds: string[] = [];
    const scoreByConcurso = new Map<string, number>();

    if (userRanking.consolidated_data?.rankings) {
      for (const [, rankingData] of Object.entries(userRanking.consolidated_data.rankings)) {
        const concursoId = (rankingData as { concurso_id?: string })?.concurso_id;
        if (!concursoId) continue;
        concursoIds.push(concursoId);
        scoreByConcurso.set(
          concursoId,
          (rankingData as { user_data?: { score?: number } })?.user_data?.score || 0
        );
      }
    }

    if (concursoIds.length === 0) return [];

    const { data: concursosData } = await supabase
      .from('concursos')
      .select('id, titulo')
      .in('id', concursoIds);

    const results = await Promise.all(
      concursoIds.map(async (concursoId) => {
        const status = await getProfileRankingStatus(concursoId, userId);
        const concursoInfo = concursosData?.find((c) => c.id === concursoId);
        const isClassified = !status.isEliminated && status.position !== null;

        return {
          concursoId,
          concursoTitle: concursoInfo?.titulo || 'Concurso sem título',
          position: status.isEliminated ? null : status.position,
          score: scoreByConcurso.get(concursoId) || 0,
          isClassified,
        } satisfies UserRankingSummary;
      })
    );

    return results;
  } catch (error) {
    devLog.error('fetchUserRankingSummaries failed', error);
    return [];
  }
}
