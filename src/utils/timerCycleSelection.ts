const STORAGE_KEY = 'convoca-timer-selected-cycle-id';

export function getStoredTimerCycleId(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredTimerCycleId(cycleId: string): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, cycleId);
  } catch {
    // ignore storage errors
  }
}

export function resolveInitialTimerCycleId(options: {
  secureCycleId?: string;
  pendingTaskCycleId?: string;
  storedCycleId?: string | null;
  availableCycleIds: string[];
}): string | null {
  const { secureCycleId, pendingTaskCycleId, storedCycleId, availableCycleIds } = options;
  if (availableCycleIds.length === 0) return null;

  const candidates = [pendingTaskCycleId, secureCycleId, storedCycleId];
  for (const candidate of candidates) {
    if (candidate && availableCycleIds.includes(candidate)) {
      return candidate;
    }
  }

  return availableCycleIds[0];
}
