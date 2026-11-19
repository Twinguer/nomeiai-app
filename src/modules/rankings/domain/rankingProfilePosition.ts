import { fetchUserRankings, type Ranking } from '@/modules/rankings/services/rankingService';

export type ProfileRankingStatus = {
  position: number | null;
  isEliminated: boolean;
};

export function isRankingEliminated(
  entry: Pick<Ranking, 'belowMinimum' | 'belowDisciplineMinimums' | 'belowBlockMinimums'>,
): boolean {
  return !!(
    entry.belowMinimum ||
    (entry.belowDisciplineMinimums && entry.belowDisciplineMinimums.length > 0) ||
    (entry.belowBlockMinimums && entry.belowBlockMinimums.length > 0)
  );
}

/**
 * Posição no perfil — mesma fonte da tabela (fetchUserRankings / rankingService).
 */
export async function getProfileRankingStatus(
  concursoId: string,
  userId: string,
): Promise<ProfileRankingStatus> {
  const list = await fetchUserRankings(concursoId);
  const entry = list.find((ranking) => ranking.userId === userId);

  if (!entry) {
    return { position: null, isEliminated: false };
  }

  const eliminated = isRankingEliminated(entry);

  return {
    position: eliminated ? null : (entry.position > 0 ? entry.position : null),
    isEliminated: eliminated,
  };
}
