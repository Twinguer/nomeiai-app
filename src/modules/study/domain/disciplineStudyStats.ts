import type { StudySession } from '@/types/userStudy';

export interface DisciplineStudyStats {
  totalMinutes: number;
  totalQuestions: number;
  correctAnswers: number;
  sessionCount: number;
  lastDate: string | null;
  lastSummary: string | null;
}

export const EMPTY_DISCIPLINE_STATS: DisciplineStudyStats = {
  totalMinutes: 0,
  totalQuestions: 0,
  correctAnswers: 0,
  sessionCount: 0,
  lastDate: null,
  lastSummary: null,
};

export function resolveDisciplineStats(
  stats: DisciplineStudyStats | null | undefined
): DisciplineStudyStats {
  return stats ?? EMPTY_DISCIPLINE_STATS;
}

export function formatStudyDurationDisplay(totalMinutes: number): string {
  if (totalMinutes <= 0) return '0min';
  return formatStudyDuration(totalMinutes) ?? '0min';
}

/** Horas decimais compactas para cards e estatísticas de tarefa (ex.: 90 → 1.5h, 60 → 1h). */
export function formatTaskDurationHours(totalMinutes: number): string {
  if (!totalMinutes || totalMinutes <= 0) return '0h';
  const hours = totalMinutes / 60;
  const rounded = Math.round(hours * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}h` : `${rounded.toFixed(1)}h`;
}

export function formatLastStudyDateDisplay(isoDate: string | null): string {
  return formatLastStudyDate(isoDate) ?? '-';
}

export type DisciplineProgressStatus = 'em_andamento' | 'em_revisao' | null;

export function normalizeDisciplineKey(name: string): string {
  return name.trim().toLowerCase();
}

export function isDisciplineInReview(discipline: {
  status?: string | null;
}): boolean {
  return discipline.status === 'em_revisao' || discipline.status === 'em-revisao';
}

export function isDisciplineEmAndamento(discipline: {
  status?: string | null;
}): boolean {
  return discipline.status === 'em_andamento';
}

export function hasDisciplineStudyStats(
  stats: DisciplineStudyStats | null | undefined
): boolean {
  const resolved = stats ? resolveDisciplineStats(stats) : EMPTY_DISCIPLINE_STATS;
  return (
    resolved.sessionCount > 0 ||
    resolved.totalMinutes > 0 ||
    resolved.totalQuestions > 0 ||
    Boolean(resolved.lastDate)
  );
}

export function isDisciplineNotStarted(
  discipline: {
    isCompleted?: boolean;
    status?: string | null;
  },
  stats?: DisciplineStudyStats | null
): boolean {
  if (isDisciplineCompletedForProgress(discipline)) return false;
  if (isDisciplineInReview(discipline)) return false;
  if (isDisciplineEmAndamento(discipline)) return false;
  if (hasDisciplineStudyStats(stats)) return false;
  return true;
}

export function shouldAutoSetEmAndamento(
  discipline: {
    isCompleted?: boolean;
    status?: string | null;
  },
  stats?: DisciplineStudyStats | null
): boolean {
  if (isDisciplineCompletedForProgress(discipline)) return false;
  if (isDisciplineInReview(discipline)) return false;
  if (!hasDisciplineStudyStats(stats)) return false;
  return !isDisciplineEmAndamento(discipline);
}

export function isDisciplineEmAndamentoEffective(
  discipline: {
    isCompleted?: boolean;
    status?: string | null;
  },
  stats?: DisciplineStudyStats | null
): boolean {
  if (isDisciplineCompletedForProgress(discipline)) return false;
  if (isDisciplineInReview(discipline)) return false;
  if (isDisciplineEmAndamento(discipline)) return true;
  return hasDisciplineStudyStats(stats);
}

type DisciplineWithProgress = {
  id: string;
  name: string;
  isCompleted?: boolean;
  status?: DisciplineProgressStatus | string | null;
};

type BlockWithProgress = {
  id: string;
  name: string;
  disciplines: DisciplineWithProgress[];
};

export function syncDisciplineProgressFromStats<TBlock extends BlockWithProgress>(
  blocks: TBlock[],
  disciplineStats: Record<string, DisciplineStudyStats>
): { blocks: TBlock[]; changed: boolean } {
  let changed = false;

  const nextBlocks = blocks.map((block) => ({
    ...block,
    disciplines: block.disciplines.map((discipline) => {
      const stats = disciplineStats[normalizeDisciplineKey(discipline.name)];
      if (!shouldAutoSetEmAndamento(discipline, stats)) {
        return discipline;
      }

      changed = true;
      return {
        ...discipline,
        status: 'em_andamento' as DisciplineProgressStatus,
      };
    }),
  }));

  return { blocks: nextBlocks, changed };
}

export function isDisciplineCompletedForProgress(discipline: {
  isCompleted?: boolean;
  status?: string | null;
}): boolean {
  if (discipline.isCompleted) return true;
  if (discipline.status === 'finalizada') return true;
  return false;
}

export function aggregateDisciplineStatsForCycle(
  sessions: StudySession[] | undefined,
  cycleId: string
): Record<string, DisciplineStudyStats> {
  const result: Record<string, DisciplineStudyStats> = {};
  if (!sessions?.length) return result;

  const relevant = sessions.filter((s) => !s.cycle_id || s.cycle_id === cycleId);

  for (const session of relevant) {
    const name = session.discipline_name?.trim();
    if (!name) continue;

    const key = normalizeDisciplineKey(name);
    const duration =
      session.total_duration_minutes ?? session.duration_minutes ?? 0;
    const questions = session.total_questions ?? session.questions ?? 0;
    const correct = session.total_correct_answers ?? session.correct_answers ?? 0;
    const date =
      session.date ?? session.session_date ?? session.last_session_date ?? null;

    if (!result[key]) {
      result[key] = {
        totalMinutes: 0,
        totalQuestions: 0,
        correctAnswers: 0,
        sessionCount: 0,
        lastDate: null,
        lastSummary: null,
      };
    }

    const agg = result[key];
    agg.totalMinutes += duration;
    agg.totalQuestions += questions;
    agg.correctAnswers += correct;
    agg.sessionCount += 1;

    if (date && (!agg.lastDate || date > agg.lastDate)) {
      agg.lastDate = date;
      const notes = session.notes?.trim();
      const course = session.course_name?.trim();
      agg.lastSummary = notes || course || null;
    }
  }

  return result;
}

export function formatStudyDuration(totalMinutes: number): string | null {
  if (totalMinutes <= 0) return null;
  if (totalMinutes < 60) return `${totalMinutes}min`;
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return mins > 0 ? `${hours}h${mins}` : `${hours}h`;
}

export function getAccuracyPercent(
  totalQuestions: number,
  correctAnswers: number
): number | null {
  if (totalQuestions <= 0) return null;
  return Math.round((correctAnswers / totalQuestions) * 100);
}

export function getAccuracyColorClass(pct: number): string {
  if (pct < 70) return 'text-red-600 dark:text-red-400 font-semibold';
  if (pct <= 80) return 'text-amber-600 dark:text-amber-400 font-semibold';
  return 'text-green-600 dark:text-green-400 font-semibold';
}

export function mergeDisciplineStats(
  items: DisciplineStudyStats[]
): DisciplineStudyStats | null {
  if (items.length === 0) return null;

  const merged: DisciplineStudyStats = {
    totalMinutes: 0,
    totalQuestions: 0,
    correctAnswers: 0,
    sessionCount: 0,
    lastDate: null,
    lastSummary: null,
  };

  for (const item of items) {
    merged.totalMinutes += item.totalMinutes;
    merged.totalQuestions += item.totalQuestions;
    merged.correctAnswers += item.correctAnswers;
    merged.sessionCount += item.sessionCount;

    if (item.lastDate && (!merged.lastDate || item.lastDate > merged.lastDate)) {
      merged.lastDate = item.lastDate;
      merged.lastSummary = item.lastSummary;
    }
  }

  if (
    merged.totalMinutes <= 0 &&
    merged.totalQuestions <= 0 &&
    !merged.lastDate
  ) {
    return null;
  }

  return merged;
}

export function aggregateBlockStats(
  disciplineNames: string[],
  disciplineStats: Record<string, DisciplineStudyStats>
): DisciplineStudyStats | null {
  const items = disciplineNames
    .map((name) => disciplineStats[normalizeDisciplineKey(name)])
    .filter((s): s is DisciplineStudyStats => Boolean(s));

  return mergeDisciplineStats(items);
}

export function formatLastStudyDate(isoDate: string | null): string | null {
  if (!isoDate) return null;
  const parts = isoDate.split('T')[0].split('-');
  if (parts.length !== 3) return null;
  const [, month, day] = parts;
  return `${day}/${month}`;
}
