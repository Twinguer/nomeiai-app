import { localStudyDateKey } from '@/modules/study/domain/timerDayTaskProgress';
import type { UserStudy } from '@/types/userStudy';

const STORAGE_PREFIX = 'convoca-timer-day-tasks-done';
const RETENTION_DAYS = 14;

export type TimerDayTaskCompletionsByDate = Record<string, Record<string, string[]>>;

function buildStorageKey(
  ownerUserId: string,
  cycleId: string,
  dateKey = localStudyDateKey()
): string {
  return `${STORAGE_PREFIX}:${ownerUserId}:${cycleId}:${dateKey}`;
}

function subtractDaysFromDateKey(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

export function trimTimerDayTaskCompletions(
  map: TimerDayTaskCompletionsByDate,
  referenceDateKey = localStudyDateKey()
): TimerDayTaskCompletionsByDate {
  const minDateKey = subtractDaysFromDateKey(referenceDateKey, RETENTION_DAYS);
  const trimmed: TimerDayTaskCompletionsByDate = {};

  for (const [dateKey, cycles] of Object.entries(map)) {
    if (dateKey >= minDateKey) {
      trimmed[dateKey] = cycles;
    }
  }

  return trimmed;
}

export function parseTimerDayTaskCompletions(value: unknown): TimerDayTaskCompletionsByDate {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const parsed: TimerDayTaskCompletionsByDate = {};

  for (const [dateKey, cyclesValue] of Object.entries(value as Record<string, unknown>)) {
    if (!cyclesValue || typeof cyclesValue !== 'object' || Array.isArray(cyclesValue)) {
      continue;
    }

    const cycles: Record<string, string[]> = {};
    for (const [cycleId, taskIdsValue] of Object.entries(cyclesValue as Record<string, unknown>)) {
      if (!Array.isArray(taskIdsValue)) continue;
      const taskIds = taskIdsValue.filter(
        (id): id is string => typeof id === 'string' && id.length > 0
      );
      cycles[cycleId] = taskIds;
    }

    if (Object.keys(cycles).length > 0) {
      parsed[dateKey] = cycles;
    }
  }

  return parsed;
}

export function readTimerDayCompletedTaskIdsFromUserStudy(
  userStudy: UserStudy | null | undefined,
  cycleId: string | null | undefined,
  dateKey = localStudyDateKey()
): Set<string> {
  if (!userStudy?.timer_day_task_completions || !cycleId) {
    return new Set();
  }

  const taskIds = userStudy.timer_day_task_completions[dateKey]?.[cycleId] ?? [];
  return new Set(taskIds);
}

export function readTimerDayCompletedTaskIdsFromLocalStorage(
  ownerUserId: string | undefined,
  cycleId: string | null | undefined,
  dateKey = localStudyDateKey()
): Set<string> {
  if (!ownerUserId || !cycleId) {
    return new Set();
  }

  try {
    const raw = localStorage.getItem(buildStorageKey(ownerUserId, cycleId, dateKey));
    if (!raw) return new Set();

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();

    return new Set(parsed.filter((id): id is string => typeof id === 'string' && id.length > 0));
  } catch {
    return new Set();
  }
}

export function writeTimerDayCompletedTaskIdsToLocalStorage(
  ownerUserId: string,
  cycleId: string,
  taskIds: ReadonlySet<string>,
  dateKey = localStudyDateKey()
): void {
  try {
    const key = buildStorageKey(ownerUserId, cycleId, dateKey);
    if (taskIds.size === 0) {
      localStorage.removeItem(key);
      return;
    }

    localStorage.setItem(key, JSON.stringify([...taskIds]));
  } catch {
    // ignore storage errors (private mode, quota, etc.)
  }
}

export function pruneTimerDayCompletedTaskIds(
  completedTaskIds: ReadonlySet<string>,
  validTaskIds: readonly string[]
): Set<string> {
  const valid = new Set(validTaskIds);
  return new Set([...completedTaskIds].filter((id) => valid.has(id)));
}

export function resolveTimerDayCompletedTaskIds(options: {
  userStudy?: UserStudy | null;
  ownerUserId?: string;
  cycleId?: string | null;
  validTaskIds: readonly string[];
  dateKey?: string;
}): Set<string> {
  const dateKey = options.dateKey ?? localStudyDateKey();
  const fromServer = readTimerDayCompletedTaskIdsFromUserStudy(
    options.userStudy,
    options.cycleId,
    dateKey
  );
  const fromLocal = readTimerDayCompletedTaskIdsFromLocalStorage(
    options.ownerUserId,
    options.cycleId,
    dateKey
  );

  const merged = new Set([...fromServer, ...fromLocal]);
  return pruneTimerDayCompletedTaskIds(merged, options.validTaskIds);
}

export function buildUpdatedTimerDayTaskCompletions(
  current: TimerDayTaskCompletionsByDate | undefined,
  cycleId: string,
  taskIds: ReadonlySet<string>,
  dateKey = localStudyDateKey()
): TimerDayTaskCompletionsByDate {
  const next = trimTimerDayTaskCompletions({ ...(current ?? {}) });
  const dayEntry = { ...(next[dateKey] ?? {}) };

  if (taskIds.size === 0) {
    delete dayEntry[cycleId];
  } else {
    dayEntry[cycleId] = [...taskIds];
  }

  if (Object.keys(dayEntry).length === 0) {
    delete next[dateKey];
  } else {
    next[dateKey] = dayEntry;
  }

  return next;
}

export function setsEqual(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  if (a.size !== b.size) return false;
  for (const value of a) {
    if (!b.has(value)) return false;
  }
  return true;
}

/** @deprecated Use readTimerDayCompletedTaskIdsFromLocalStorage */
export const readTimerDayCompletedTaskIds = readTimerDayCompletedTaskIdsFromLocalStorage;

/** @deprecated Use writeTimerDayCompletedTaskIdsToLocalStorage */
export const writeTimerDayCompletedTaskIds = writeTimerDayCompletedTaskIdsToLocalStorage;
