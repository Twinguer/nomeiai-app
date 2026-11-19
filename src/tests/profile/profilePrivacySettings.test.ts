import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PROFILE_PRIVACY,
  parseProfilePrivacySettings,
} from '@/utils/profilePrivacySettings';

describe('profilePrivacySettings', () => {
  it('usa defaults quando valor é inválido', () => {
    expect(parseProfilePrivacySettings(null)).toEqual(DEFAULT_PROFILE_PRIVACY);
  });

  it('interpreta showPublicAboutInfo', () => {
    expect(
      parseProfilePrivacySettings({
        showPublicAboutInfo: true,
        showPublicRankings: true,
      })
    ).toEqual({
      showPublicRankings: true,
      showPublicStudyStats: false,
      showPublicRankingPosition: false,
      showPublicAboutInfo: true,
    });
  });
});
