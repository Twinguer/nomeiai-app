import { describe, it, expect } from 'vitest';
import {
  canRespondToInvitation,
  effectiveInvitationStatus,
  isCoachSubscriptionActive,
  isInvitationExpired,
  isInvitationPending,
} from '@/modules/coach';

const NOW = new Date('2026-05-15T12:00:00');

describe('invitationRules', () => {
  it('isInvitationPending only for pending status', () => {
    expect(isInvitationPending('pending')).toBe(true);
    expect(isInvitationPending('accepted')).toBe(false);
    expect(isInvitationPending('expired')).toBe(false);
  });

  it('isInvitationExpired compares expires_at with now', () => {
    expect(isInvitationExpired('2026-05-14T00:00:00', NOW)).toBe(true);
    expect(isInvitationExpired('2026-05-16T00:00:00', NOW)).toBe(false);
  });

  it('canRespondToInvitation requires pending and not expired', () => {
    expect(canRespondToInvitation('pending', '2026-05-20T00:00:00', NOW)).toBe(true);
    expect(canRespondToInvitation('accepted', '2026-05-20T00:00:00', NOW)).toBe(false);
    expect(canRespondToInvitation('pending', '2026-05-10T00:00:00', NOW)).toBe(false);
  });

  it('effectiveInvitationStatus marks pending+past as expired', () => {
    expect(effectiveInvitationStatus('pending', '2026-05-10T00:00:00', NOW)).toBe('expired');
    expect(effectiveInvitationStatus('pending', '2026-05-20T00:00:00', NOW)).toBe('pending');
    expect(effectiveInvitationStatus('accepted', '2026-05-10T00:00:00', NOW)).toBe('accepted');
  });

  it('isCoachSubscriptionActive requires active status and valid expires_at', () => {
    expect(isCoachSubscriptionActive('active', null, NOW)).toBe(true);
    expect(isCoachSubscriptionActive('active', '2026-06-01T00:00:00', NOW)).toBe(true);
    expect(isCoachSubscriptionActive('active', '2026-05-01T00:00:00', NOW)).toBe(false);
    expect(isCoachSubscriptionActive('cancelled', null, NOW)).toBe(false);
  });
});
