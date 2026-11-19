import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isRankingEliminated, getProfileRankingStatus } from '@/modules/rankings';

vi.mock('@/modules/rankings/services/rankingService', () => ({
  fetchUserRankings: vi.fn(),
}));

import { fetchUserRankings } from '@/modules/rankings/services/rankingService';

describe('rankingProfilePosition', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isRankingEliminated', () => {
    it('identifica eliminado por belowMinimum', () => {
      expect(isRankingEliminated({ belowMinimum: true })).toBe(true);
    });

    it('identifica eliminado por mínimos de disciplina', () => {
      expect(
        isRankingEliminated({ belowDisciplineMinimums: ['Matemática'] }),
      ).toBe(true);
    });

    it('considera classificado quando sem flags de eliminação', () => {
      expect(isRankingEliminated({})).toBe(false);
    });
  });

  describe('getProfileRankingStatus', () => {
    it('retorna posição do usuário na mesma fonte da classificação', async () => {
      vi.mocked(fetchUserRankings).mockResolvedValue([
        {
          userId: 'user-1',
          position: 3,
          belowMinimum: false,
        },
        {
          userId: 'user-2',
          position: 1,
          belowMinimum: false,
        },
      ] as any);

      const result = await getProfileRankingStatus('concurso-1', 'user-1');
      expect(result).toEqual({ position: 3, isEliminated: false });
    });

    it('retorna eliminado sem posição quando belowMinimum', async () => {
      vi.mocked(fetchUserRankings).mockResolvedValue([
        {
          userId: 'user-1',
          position: 5,
          belowMinimum: true,
        },
      ] as any);

      const result = await getProfileRankingStatus('concurso-1', 'user-1');
      expect(result).toEqual({ position: null, isEliminated: true });
    });

    it('retorna null quando usuário não está na lista', async () => {
      vi.mocked(fetchUserRankings).mockResolvedValue([]);

      const result = await getProfileRankingStatus('concurso-1', 'user-1');
      expect(result).toEqual({ position: null, isEliminated: false });
    });
  });
});
