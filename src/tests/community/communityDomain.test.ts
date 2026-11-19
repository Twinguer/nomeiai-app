import { describe, it, expect } from 'vitest';
import {
  mapCommunityProfileFlags,
  usesCommunityCoachCardFormat,
} from '@/modules/community/domain/communityProfileRules';
import { getCommunityUserPriority, sortCommunityUsers } from '@/modules/community/domain/communityUserSort';
import {
  canRequestToJoinGroup,
  getPrivacyLabel,
  isPrivateGroup,
  isPublicGroup,
} from '@/modules/community/domain/groupVisibilityRules';

describe('communityProfileRules', () => {
  it('detects coach card format', () => {
    expect(usesCommunityCoachCardFormat({ is_coach: true })).toBe(true);
    expect(usesCommunityCoachCardFormat({ is_coach: false })).toBe(false);
  });

  it('maps pro flag including coach', () => {
    const flags = mapCommunityProfileFlags({ is_coach: true, is_pro: false });
    expect(flags.isCoach).toBe(true);
    expect(flags.isPro).toBe(true);
  });
});

describe('communityUserSort', () => {
  it('prioritizes coach online over pro offline', () => {
    expect(getCommunityUserPriority(true, false, true)).toBeGreaterThan(
      getCommunityUserPriority(false, true, false)
    );
  });

  it('sorts users by priority then name', () => {
    const sorted = sortCommunityUsers(
      [
        { id: '1', name: 'Zara', isCoach: false, isPro: false },
        { id: '2', name: 'Ana', isCoach: true, isPro: true },
      ],
      () => false
    );
    expect(sorted[0].id).toBe('2');
  });
});

describe('groupVisibilityRules', () => {
  it('identifies public vs private groups', () => {
    expect(isPublicGroup('public')).toBe(true);
    expect(isPrivateGroup('private')).toBe(true);
    expect(canRequestToJoinGroup('public')).toBe(true);
    expect(canRequestToJoinGroup('private')).toBe(false);
  });

  it('returns privacy labels', () => {
    expect(getPrivacyLabel('invite_only')).toBe('Apenas convite');
  });
});
