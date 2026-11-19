import { describe, it, expect } from 'vitest';
import { RPCValidator } from '@/utils/rpcValidator';

describe('RPCValidator.validateRankingData', () => {
  it('preserva user_data e reservation_type para participate_in_ranking', () => {
    const input = {
      concurso_id: 'concurso-1',
      edit_count: 0,
      selected_booklet_id: 'booklet-1',
      user_data: {
        score: 0,
        reservation_type: 'PPP',
        answers: {},
      },
      control_metadata: {
        created_at: '2026-01-01T00:00:00.000Z',
      },
    };

    const validated = RPCValidator.validateRankingData(input);

    expect(validated.user_data.reservation_type).toBe('PPP');
    expect(validated.user_data.score).toBe(0);
    expect(validated.control_metadata.created_at).toBe(input.control_metadata.created_at);
    expect(validated.concurso_id).toBe('concurso-1');
  });

  it('rejeita reservation_type vazio', () => {
    expect(() =>
      RPCValidator.validateRankingData({
        user_data: { reservation_type: '   ' },
      })
    ).toThrow('reservation_type não pode ser vazio');
  });
});
