import type { StudyCycleV2, StudySchedule } from '@/types/userStudy';

export type ScheduleMode = 'duration' | 'time';

export const DEFAULT_SCHEDULE_MODE: ScheduleMode = 'duration';

/** Converte dia armazenado (0–6 ou ISO 1–7) para índice UI 0=domingo … 6=sábado */
export function toUiDayOfWeek(stored: number): number {
  if (stored >= 1 && stored <= 7) {
    return stored === 7 ? 0 : stored;
  }
  return stored;
}

/** Persistência: sempre 0–6 (domingo = 0) */
export function toStorageDayOfWeek(uiDay: number): number {
  return uiDay;
}

export function isTimeBasedSession(
  session: Pick<StudySchedule, 'start_time' | 'end_time' | 'duration_minutes'>
): boolean {
  return Boolean(session.start_time && session.end_time);
}

export function getCycleScheduleMode(
  cycle: StudyCycleV2 | undefined,
  cycleSessions: StudySchedule[]
): ScheduleMode | null {
  const fromMeta = (cycle?.schedule_data?.metadata as { schedule_mode?: ScheduleMode })?.schedule_mode;
  if (fromMeta === 'time' || fromMeta === 'duration') {
    return fromMeta;
  }
  if (cycleSessions.length === 0) return null;
  const hasTime = cycleSessions.some((s) => isTimeBasedSession(s));
  return hasTime ? 'time' : 'duration';
}

export function canReorderSession(
  cycleMode: ScheduleMode | null,
  cycleId: string,
  sessionCycleId: string
): boolean {
  return cycleMode === 'duration' && cycleId === sessionCycleId;
}

export function sortScheduleSessionsForDisplay<
  T extends {
    day: number;
    startTime?: string;
    endTime?: string;
    durationMinutes?: number;
    displayOrder?: number;
    cycleId: string;
  }
>(sessions: T[], cycleMode: ScheduleMode | null, cycleId: string): T[] {
  const daySessions = sessions.filter((s) => s.cycleId === cycleId);
  const other = sessions.filter((s) => s.cycleId !== cycleId);

  const sorted =
    cycleMode === 'duration'
      ? [...daySessions].sort((a, b) => {
          if (a.day !== b.day) return a.day - b.day;
          const oa = a.displayOrder ?? 0;
          const ob = b.displayOrder ?? 0;
          if (oa !== ob) return oa - ob;
          return (a.durationMinutes || 0) - (b.durationMinutes || 0);
        })
      : [...daySessions].sort((a, b) => {
          if (a.day !== b.day) return a.day - b.day;
          if (a.startTime && b.startTime) return a.startTime.localeCompare(b.startTime);
          if (a.startTime && !b.startTime) return -1;
          if (!a.startTime && b.startTime) return 1;
          return (a.durationMinutes || 0) - (b.durationMinutes || 0);
        });

  return [...other, ...sorted];
}

export function assignDisplayOrdersForCycle(
  schedule: StudySchedule[],
  cycleId: string,
  uiDay: number,
  orderedIds: string[]
): StudySchedule[] {
  return schedule.map((s) => {
    if (s.cycle_id !== cycleId || toUiDayOfWeek(s.day_of_week) !== uiDay) return s;
    const idx = orderedIds.indexOf(s.id);
    if (idx === -1) return s;
    return { ...s, display_order: idx, updated_at: new Date().toISOString() };
  });
}
