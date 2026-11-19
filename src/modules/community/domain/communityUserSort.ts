export type CommunitySortableUser = {
  id: string;
  name?: string | null;
  isCoach?: boolean;
  isPro?: boolean;
};

export function getCommunityUserPriority(
  isCoach: boolean,
  isPro: boolean,
  online: boolean
): number {
  if (isCoach && online) return 6;
  if (isCoach && !online) return 5;
  if (isPro && online) return 4;
  if (isPro && !online) return 3;
  if (!isCoach && !isPro && online) return 2;
  return 1;
}

/** Ordena: Coach > Pro > Free, depois online, depois nome. */
export function sortCommunityUsers<T extends CommunitySortableUser>(
  users: T[],
  isOnline: (userId: string) => boolean
): T[] {
  if (!users.length) return users;

  return [...users].sort((a, b) => {
    const aPriority = getCommunityUserPriority(
      Boolean(a.isCoach),
      Boolean(a.isPro),
      isOnline(a.id)
    );
    const bPriority = getCommunityUserPriority(
      Boolean(b.isCoach),
      Boolean(b.isPro),
      isOnline(b.id)
    );

    if (aPriority !== bPriority) return bPriority - aPriority;
    return (a.name || '').localeCompare(b.name || '');
  });
}
