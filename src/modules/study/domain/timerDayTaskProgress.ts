import type { StudySession } from '@/types/userStudy';
import type { CronogramaStudySession } from '../hooks/useCronogramaData';

export function localStudyDateKey(date = new Date()): string {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .split('T')[0];
}

export function resolveSessionDurationMinutes(session: StudySession): number {
  return Math.max(0, session.duration_minutes ?? session.total_duration_minutes ?? 0);
}

export function resolveSessionDateKey(session: StudySession): string | null {
  return session.date ?? session.session_date ?? session.last_session_date ?? null;
}

function parseClockToMinutes(time: string): number | null {
  const parts = time.trim().split(':');
  if (parts.length < 2) return null;
  const hours = Number(parts[0]);
  const minutes = Number(parts[1]);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
}

export function resolvePlannedMinutes(task: CronogramaStudySession): number {
  if (task.durationMinutes && task.durationMinutes > 0) {
    return task.durationMinutes;
  }

  if (task.startTime && task.endTime) {
    const start = parseClockToMinutes(task.startTime);
    const end = parseClockToMinutes(task.endTime);
    if (start != null && end != null && end > start) {
      return end - start;
    }
  }

  return 0;
}

export function getTodayStudiedMinutesByTaskId(
  studySessions: StudySession[],
  options?: {
    dateKey?: string;
    cycleId?: string | null;
  }
): Record<string, number> {
  const dateKey = options?.dateKey ?? localStudyDateKey();
  const totals: Record<string, number> = {};

  for (const session of studySessions) {
    if (resolveSessionDateKey(session) !== dateKey) continue;

    if (options?.cycleId) {
      const sessionCycleId = (session as StudySession & { cycle_id?: string }).cycle_id;
      if (sessionCycleId && sessionCycleId !== options.cycleId) continue;
    }

    const taskId = session.schedule_session_id;
    if (!taskId) continue;

    totals[taskId] = (totals[taskId] ?? 0) + resolveSessionDurationMinutes(session);
  }

  return totals;
}

export function formatTaskScheduleLabel(task: CronogramaStudySession): string {
  if (task.durationMinutes) {
    return `${task.durationMinutes} min`;
  }
  if (task.startTime && task.endTime) {
    return `${task.startTime.substring(0, 5)} – ${task.endTime.substring(0, 5)}`;
  }
  return 'Horário livre';
}

export function formatTaskProgressLabel(
  task: CronogramaStudySession,
  studiedMinutes: number
): string {
  const planned = resolvePlannedMinutes(task);
  const studiedPart = `${studiedMinutes} min feito`;

  if (planned > 0) {
    return `${planned} min planejado · ${studiedPart}`;
  }

  const schedulePart = formatTaskScheduleLabel(task);
  if (studiedMinutes > 0) {
    return `${schedulePart} · ${studiedPart}`;
  }

  return schedulePart;
}
