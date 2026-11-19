/**
 * Regras de exibição dos cards da comunidade (alinha com get_public_community_profiles).
 */
export type CommunityProfileFlags = {
  is_coach?: boolean | null;
  is_pro?: boolean | null;
  has_active_coach?: boolean | null;
  active_student_count?: number | null;
};

/** Card lilás + badge verde na comunidade (assinatura coach ativa no backend). */
export function usesCommunityCoachCardFormat(profile: CommunityProfileFlags): boolean {
  return Boolean(profile.is_coach);
}

export function mapCommunityProfileFlags(profile: CommunityProfileFlags) {
  const isCoach = usesCommunityCoachCardFormat(profile);
  const hasActiveCoach = Boolean(profile.has_active_coach);
  const activeStudentCount = profile.active_student_count ?? 0;
  const isProPlan = Boolean(profile.is_pro);
  const isPro = isProPlan || isCoach || hasActiveCoach;

  return {
    isCoach,
    hasActiveCoach,
    activeStudentCount,
    isPro,
  };
}
