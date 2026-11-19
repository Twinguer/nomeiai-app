import { describe, it, expect, vi, beforeEach } from 'vitest';
import { coachAccessService } from '@/modules/coach/services/coachAccessService';
import { coachSubscriptionService } from '@/modules/coach/services/coachSubscriptionService';

const rpcMock = vi.fn();
const fromMock = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpcMock(...args),
    from: (...args: unknown[]) => fromMock(...args),
  },
}));

vi.mock('@/utils/productionLogger', () => ({
  devLog: { error: vi.fn(), log: vi.fn() },
}));

describe('coachAccessService', () => {
  beforeEach(() => {
    rpcMock.mockReset();
  });

  it('checkHasStudentAccess normalizes string allowed flag', async () => {
    rpcMock.mockResolvedValue({
      data: { allowed: 'true', message: 'OK' },
      error: null,
    });

    const result = await coachAccessService.checkHasStudentAccess('coach-1', 'student-1');

    expect(rpcMock).toHaveBeenCalledWith('check_coach_has_student_access', {
      p_coach_id: 'coach-1',
      p_student_id: 'student-1',
    });
    expect(result).toEqual({ allowed: true, reason: undefined, message: 'OK' });
  });

  it('checkHasStudentAccess throws on RPC error', async () => {
    rpcMock.mockResolvedValue({ data: null, error: new Error('rpc failed') });

    await expect(
      coachAccessService.checkHasStudentAccess('coach-1', 'student-1')
    ).rejects.toThrow('rpc failed');
  });
});

describe('coachSubscriptionService', () => {
  beforeEach(() => {
    rpcMock.mockReset();
    fromMock.mockReset();
  });

  it('checkIfCanInvite returns RPC payload', async () => {
    const payload = { can_invite: false, reason: 'limit', current: 5, max: 5 };
    rpcMock.mockResolvedValue({ data: payload, error: null });

    const result = await coachSubscriptionService.checkIfCanInvite('coach-1');

    expect(rpcMock).toHaveBeenCalledWith('check_if_can_invite_student', {
      p_coach_id: 'coach-1',
    });
    expect(result).toEqual(payload);
  });

  it('getCoachSubscription returns null when no row', async () => {
    fromMock.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      }),
    });

    const result = await coachSubscriptionService.getCoachSubscription('coach-1');
    expect(result).toBeNull();
  });
});
