import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchUserRankings } from '@/modules/rankings/services/rankingService';

const rpcMock = vi.fn();
const fromMock = vi.fn();

vi.mock('@/modules/rankings/services/rankingCache', () => ({
  rankingCache: {
    getRankings: vi.fn(() => null),
    setRankings: vi.fn(),
  },
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpcMock(...args),
    from: (...args: unknown[]) => fromMock(...args),
  },
}));

const CONCURSO_ID = 'concurso-1';

function mockConcursoQuery(overrides: Record<string, unknown> = {}) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: { exam_type: 'Múltipla Escolha', disciplines: {}, ...overrides },
          error: null,
        }),
      }),
    }),
  };
}

function mockProfilesQuery(profiles: Array<{ id: string; name: string; avatar_url: null }>) {
  return {
    select: vi.fn().mockReturnValue({
      in: vi.fn().mockResolvedValue({
        data: profiles,
        error: null,
      }),
    }),
  };
}

function buildRpcUser(
  userId: string,
  rankingId: string,
  userData: Record<string, unknown>,
  controlMetadata?: Record<string, unknown>,
) {
  return {
    user_id: userId,
    consolidated_data: {
      rankings: {
        [rankingId]: {
          concurso_id: CONCURSO_ID,
          user_data: userData,
          control_metadata: controlMetadata,
        },
      },
    },
  };
}

describe('fetchUserRankings (RPC get_rankings_for_concurso)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fromMock.mockImplementation((table: string) => {
      if (table === 'concursos') return mockConcursoQuery();
      if (table === 'users_profiles') {
        return mockProfilesQuery([
          { id: 'user-1', name: 'Primeiro', avatar_url: null },
          { id: 'user-2', name: 'Segundo', avatar_url: null },
        ]);
      }
      throw new Error(`Unexpected table: ${table}`);
    });
  });

  it('mapeia rankings retornados pelo RPC', async () => {
    rpcMock.mockResolvedValue({
      data: [
        buildRpcUser('user-1', 'rank-1', {
          score: 85,
          reservation_type: 'Ampla Concorrência',
          belowMinimum: false,
        }, { created_at: '2024-06-01T10:00:00Z' }),
      ],
      error: null,
    });

    const result = await fetchUserRankings(CONCURSO_ID);

    expect(rpcMock).toHaveBeenCalledWith('get_rankings_for_concurso', {
      p_concurso_id: CONCURSO_ID,
      p_reservation_type: null,
      p_offset: 0,
      p_limit: 100,
    });
    expect(result).toHaveLength(1);
    expect(result[0].userId).toBe('user-1');
    expect(result[0].score).toBe(85);
    expect(result[0].position).toBe(1);
    expect(result[0].name).toBe('Primeiro');
  });

  it('retorna array vazio quando RPC não traz participantes', async () => {
    rpcMock.mockResolvedValue({ data: [], error: null });

    const result = await fetchUserRankings(CONCURSO_ID);

    expect(result).toEqual([]);
  });

  it('propaga erro quando RPC falha', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: 'RPC failure', code: '500' },
    });

    await expect(fetchUserRankings(CONCURSO_ID)).rejects.toThrow(/Ranking query error/);
  });

  it('desempata por data de registro quando scores são iguais', async () => {
    rpcMock.mockResolvedValue({
      data: [
        buildRpcUser('user-2', 'rank-2', {
          score: 90,
          reservation_type: 'Ampla Concorrência',
          belowMinimum: false,
        }, { created_at: '2024-06-02T10:00:00Z' }),
        buildRpcUser('user-1', 'rank-1', {
          score: 90,
          reservation_type: 'Ampla Concorrência',
          belowMinimum: false,
        }, { created_at: '2024-06-01T10:00:00Z' }),
      ],
      error: null,
    });

    const result = await fetchUserRankings(CONCURSO_ID);

    expect(result).toHaveLength(2);
    expect(result[0].userId).toBe('user-1');
    expect(result[0].position).toBe(1);
    expect(result[1].userId).toBe('user-2');
    expect(result[1].position).toBe(2);
  });

  it('coloca eliminados após classificados', async () => {
    rpcMock.mockResolvedValue({
      data: [
        buildRpcUser('user-elim', 'rank-e', {
          score: 95,
          reservation_type: 'Ampla Concorrência',
          belowMinimum: true,
        }, { created_at: '2024-06-01T08:00:00Z' }),
        buildRpcUser('user-ok', 'rank-ok', {
          score: 70,
          reservation_type: 'Ampla Concorrência',
          belowMinimum: false,
        }, { created_at: '2024-06-01T09:00:00Z' }),
      ],
      error: null,
    });

    const result = await fetchUserRankings(CONCURSO_ID);

    expect(result).toHaveLength(2);
    expect(result[0].userId).toBe('user-ok');
    expect(result[0].position).toBe(1);
    expect(result[0].belowMinimum).toBe(false);
    expect(result[1].userId).toBe('user-elim');
    expect(result[1].position).toBe(0);
    expect(result[1].belowMinimum).toBe(true);
  });

  it('elimina participante com nota zero em prova Certo ou Errado', async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === 'concursos') {
        return mockConcursoQuery({ exam_type: 'Certo ou Errado', disciplines: {} });
      }
      if (table === 'users_profiles') {
        return mockProfilesQuery([
          { id: 'user-zero', name: 'Zero', avatar_url: null },
          { id: 'user-pos', name: 'Positivo', avatar_url: null },
        ]);
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    rpcMock.mockResolvedValue({
      data: [
        buildRpcUser('user-zero', 'rank-z', {
          score: 0,
          reservation_type: 'Ampla Concorrência',
          belowMinimum: false,
        }),
        buildRpcUser('user-pos', 'rank-p', {
          score: 5,
          reservation_type: 'Ampla Concorrência',
          belowMinimum: false,
        }),
      ],
      error: null,
    });

    const result = await fetchUserRankings(CONCURSO_ID);

    expect(result[0].userId).toBe('user-pos');
    expect(result[0].position).toBe(1);
    expect(result[1].userId).toBe('user-zero');
    expect(result[1].position).toBe(0);
    expect(result[1].belowMinimum).toBe(true);
  });
});
