import { describe, it, expect } from 'vitest';
import { isActiveCoachSubscription } from '@/modules/coach';
import type { CoachSubscription } from '@/modules/coach';

const baseSubscription: CoachSubscription = {
  id: '1',
  coach_id: 'c1',
  plan_type: 'starter',
  status: 'active',
  max_students: 5,
  current_students: 1,
  price: 49.9,
  created_at: '',
  updated_at: '',
  expires_at: null,
};

describe('isActiveCoachSubscription', () => {
  it('returns true for active subscription without expiry', () => {
    expect(isActiveCoachSubscription(baseSubscription)).toBe(true);
  });

  it('returns false for cancelled subscription', () => {
    expect(isActiveCoachSubscription({ ...baseSubscription, status: 'cancelled' })).toBe(false);
  });

  it('returns false for expired subscription', () => {
    expect(
      isActiveCoachSubscription({
        ...baseSubscription,
        expires_at: '2020-01-01T00:00:00Z',
      })
    ).toBe(false);
  });

  it('returns false for null', () => {
    expect(isActiveCoachSubscription(null)).toBe(false);
  });
});
