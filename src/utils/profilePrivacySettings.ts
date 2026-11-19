export interface ProfilePrivacySettings {
  showPublicRankings: boolean;
  showPublicStudyStats: boolean;
  showPublicRankingPosition: boolean;
  showPublicAboutInfo: boolean;
}

export const DEFAULT_PROFILE_PRIVACY: ProfilePrivacySettings = {
  showPublicRankings: false,
  showPublicStudyStats: false,
  showPublicRankingPosition: false,
  showPublicAboutInfo: false,
};

export function parseProfilePrivacySettings(raw: unknown): ProfilePrivacySettings {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_PROFILE_PRIVACY };
  }
  const o = raw as Record<string, unknown>;
  return {
    showPublicRankings: o.showPublicRankings === true,
    showPublicStudyStats: o.showPublicStudyStats === true,
    showPublicRankingPosition: o.showPublicRankingPosition === true,
    showPublicAboutInfo: o.showPublicAboutInfo === true,
  };
}
