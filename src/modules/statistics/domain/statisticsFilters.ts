import type { StudyStatistics } from '@/types/userStudy';

export type StudyTimeFilter = 'day' | 'week' | 'month';

/** Chave YYYY-MM-DD no fuso local (evita deslocar dia com UTC). */
export function toLocalDateKey(input: string | Date): string {
  if (typeof input === 'string') {
    const isoDate = input.match(/^(\d{4}-\d{2}-\d{2})/);
    if (isoDate) return isoDate[1];
  }
  const d = typeof input === 'string' ? new Date(input) : input;
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function getPeriodStartDate(filter: StudyTimeFilter, now = new Date()): Date {
  const start = new Date(now);
  switch (filter) {
    case 'day':
      start.setHours(0, 0, 0, 0);
      return start;
    case 'week':
      start.setDate(now.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      return start;
    case 'month':
      start.setDate(now.getDate() - 29);
      start.setHours(0, 0, 0, 0);
      return start;
  }
}

export function getPeriodDayCount(filter: StudyTimeFilter): number {
  switch (filter) {
    case 'day':
      return 1;
    case 'week':
      return 7;
    case 'month':
      return 30;
  }
}

export function isSessionInPeriod(
  sessionDate: string,
  filter: StudyTimeFilter,
  now = new Date()
): boolean {
  const key = toLocalDateKey(sessionDate);
  if (!key) return false;
  const sessionDay = new Date(`${key}T12:00:00`);
  return sessionDay >= getPeriodStartDate(filter, now);
}

export function filterSessionHistory(
  statistics: StudyStatistics,
  filter: StudyTimeFilter,
  now = new Date()
) {
  const history = statistics.sessionHistory || [];
  return history.filter((s) => s?.date && isSessionInPeriod(s.date, filter, now));
}

function aggregateSubjectStats(
  sessions: StudyStatistics['sessionHistory']
): StudyStatistics['subjectStats'] {
  const subjectStats: StudyStatistics['subjectStats'] = {};

  sessions.forEach((session) => {
    const subject = session.subject || 'Sem Disciplina';
    if (!subjectStats[subject]) {
      subjectStats[subject] = {
        totalHours: 0,
        totalSessions: 0,
        questionsAnswered: 0,
        correctAnswers: 0,
        wrongAnswers: 0,
      };
    }
    const agg = subjectStats[subject];
    agg.totalHours += (session.duration || 0) / 60;
    agg.totalSessions += 1;
    const q = session.questions ?? 0;
    const c = session.correctAnswers ?? 0;
    agg.questionsAnswered += q;
    agg.correctAnswers += c;
    agg.wrongAnswers += Math.max(0, q - c);
  });

  return subjectStats;
}

export function getStatisticsForPeriod(
  statistics: StudyStatistics,
  filter: StudyTimeFilter,
  now = new Date()
): StudyStatistics {
  const sessionHistory = filterSessionHistory(statistics, filter, now);

  const totalHours = sessionHistory.reduce((sum, s) => sum + (s.duration || 0) / 60, 0);
  const totalSessions = sessionHistory.length;
  const questionsAnswered = sessionHistory.reduce((sum, s) => sum + (s.questions ?? 0), 0);
  const correctAnswers = sessionHistory.reduce((sum, s) => sum + (s.correctAnswers ?? 0), 0);
  const wrongAnswers = Math.max(0, questionsAnswered - correctAnswers);
  const divisor = getPeriodDayCount(filter);

  return {
    ...statistics,
    totalHours,
    totalSessions,
    questionsAnswered,
    correctAnswers,
    wrongAnswers,
    sessionHistory,
    subjectStats: aggregateSubjectStats(sessionHistory),
    averages: {
      ...statistics.averages,
      dailyHours: totalHours / divisor,
    },
  };
}

export function getFilteredPeriodSummary(
  statistics: StudyStatistics,
  filter: StudyTimeFilter,
  now = new Date()
) {
  const sessionHistory = filterSessionHistory(statistics, filter, now);
  const totalHours = sessionHistory.reduce((sum, s) => sum + (s.duration || 0) / 60, 0);
  const divisor = getPeriodDayCount(filter);

  return {
    hours: totalHours,
    sessions: sessionHistory.length,
    average: totalHours / divisor,
    questionsAnswered: sessionHistory.reduce((sum, s) => sum + (s.questions ?? 0), 0),
    correctAnswers: sessionHistory.reduce((sum, s) => sum + (s.correctAnswers ?? 0), 0),
  };
}
