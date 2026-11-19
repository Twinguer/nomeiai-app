import type { StudySession, UserStudy } from '@/types/userStudy';
import {
  calculateStudyStatistics,
  getLastStudyActivityDate,
  getStudySessionDateString,
  getStudySessionDurationMinutes,
} from '@/utils/userStudyHelpers';
import { getStartOfLast7Days, isDateOnOrAfter } from '@/utils/dateFormat';

/** Métricas exibidas no dashboard coach (subset de StudentPerformance). */
export type CoachStudentPerformanceSnapshot = {
  hours_this_week: number;
  hours_last_week: number;
  sessions_this_week: number;
  tasks_completed: number;
  tasks_pending: number;
  completion_rate: number;
  engagement_score: number;
  last_activity: string | null;
};

export const EMPTY_COACH_STUDENT_PERFORMANCE: CoachStudentPerformanceSnapshot = {
  hours_this_week: 0,
  hours_last_week: 0,
  sessions_this_week: 0,
  tasks_completed: 0,
  tasks_pending: 0,
  completion_rate: 0,
  engagement_score: 0,
  last_activity: null,
};

export type ComputeCoachStudentPerformanceOptions = {
  /** Início do período rolling de 7 dias (padrão: hoje − 6 dias, meia-noite local). */
  periodStart?: Date;
};

function filterSessionsInPeriod(
  sessions: StudySession[],
  periodStart: Date
): StudySession[] {
  return sessions.filter((session) => {
    const dateStr = getStudySessionDateString(session);
    return dateStr ? isDateOnOrAfter(dateStr, periodStart) : false;
  });
}

function sumSessionHours(sessions: StudySession[]): number {
  return sessions.reduce(
    (sum, session) => sum + getStudySessionDurationMinutes(session) / 60,
    0
  );
}

/**
 * Calcula performance do aluno a partir de user_study (read-only).
 * Extraído de CoachDashboard — mesma fórmula de engagement e completion.
 */
export function computeCoachStudentPerformanceFromStudyData(
  studyData: UserStudy | null | undefined,
  options?: ComputeCoachStudentPerformanceOptions
): CoachStudentPerformanceSnapshot {
  if (!studyData) {
    return { ...EMPTY_COACH_STUDENT_PERFORMANCE };
  }

  const last_activity = getLastStudyActivityDate(studyData);
  const periodStart = options?.periodStart ?? getStartOfLast7Days();
  const sessions: StudySession[] = studyData.study_sessions || [];
  const last7DaysSessions = filterSessionsInPeriod(sessions, periodStart);
  const hoursLast7Days = sumSessionHours(last7DaysSessions);
  const tasksLast7Days = last7DaysSessions.length;

  if (sessions.length === 0) {
    return {
      hours_this_week: hoursLast7Days,
      hours_last_week: 0,
      sessions_this_week: tasksLast7Days,
      tasks_completed: tasksLast7Days,
      tasks_pending: 0,
      completion_rate: 0,
      engagement_score: Math.min(10, hoursLast7Days / 2),
      last_activity,
    };
  }

  const stats = calculateStudyStatistics(sessions);

  return {
    hours_this_week: hoursLast7Days,
    hours_last_week: Math.max(0, (stats.totalHours - hoursLast7Days) * 0.8),
    sessions_this_week: tasksLast7Days,
    tasks_completed: tasksLast7Days,
    tasks_pending: 0,
    completion_rate:
      sessions.length > 0 ? (last7DaysSessions.length / sessions.length) * 100 : 0,
    engagement_score: Math.min(10, (hoursLast7Days / 20) * 10),
    last_activity,
  };
}
