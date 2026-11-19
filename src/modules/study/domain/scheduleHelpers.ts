import { StudySchedule, UserStudy } from '@/types/userStudy';

/**
 * Helper functions for managing study schedule sessions
 * Supports both new (study_schedule) and legacy (study_cycles.weekly_schedule) structures
 */

export function getScheduleSessions(
  userStudy: UserStudy,
  cycleId?: string,
  dayOfWeek?: number
): StudySchedule[] {
  const sessions: StudySchedule[] = [];

  if (userStudy.study_schedule && userStudy.study_schedule.length > 0) {
    userStudy.study_schedule.forEach((session) => {
      if (cycleId && session.cycle_id !== cycleId) return;
      if (dayOfWeek !== undefined && session.day_of_week !== dayOfWeek) return;

      sessions.push(session);
    });
  }

  if (sessions.length === 0 && userStudy.study_cycles && userStudy.study_cycles.length > 0) {
    userStudy.study_cycles.forEach((cycle) => {
      if (cycleId && cycle.id !== cycleId) return;

      const weeklySchedule = cycle.schedule_data?.weekly_schedule;
      if (weeklySchedule && Array.isArray(weeklySchedule)) {
        weeklySchedule.forEach((dayData) => {
          if (dayOfWeek !== undefined && dayData.day !== dayOfWeek) return;

          if (dayData.sessions && Array.isArray(dayData.sessions)) {
            dayData.sessions.forEach((session) => {
              sessions.push({
                id: session.id,
                schedule_session_id: session.id,
                cycle_id: cycle.id,
                day_of_week: dayData.day,
                start_time: session.start_time,
                end_time: session.end_time,
                discipline_name: session.discipline_name,
                block_name: session.block_name,
                session_link: session.session_link,
                study_plan_id: session.study_plan_id,
                subject_id: session.subject_id,
                total_stats: session.total_stats,
                created_at: session.created_at || new Date().toISOString(),
                updated_at: session.updated_at || new Date().toISOString(),
              });
            });
          }
        });
      }
    });
  }

  return sessions;
}

export function formatSessionForSchedule(
  session: Partial<StudySchedule>,
  cycleId: string,
  dayOfWeek: number
): StudySchedule {
  return {
    id: session.id || crypto.randomUUID(),
    schedule_session_id: session.schedule_session_id,
    cycle_id: cycleId,
    day_of_week: dayOfWeek,
    start_time: session.start_time!,
    end_time: session.end_time!,
    discipline_name: session.discipline_name,
    block_name: session.block_name,
    session_link: session.session_link,
    study_plan_id: session.study_plan_id,
    subject_id: session.subject_id,
    total_stats: session.total_stats || {
      session_count: 0,
      total_duration_minutes: 0,
      total_questions: 0,
      total_correct: 0,
      last_session_date: '',
    },
    created_at: session.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export function groupSessionsByDay(sessions: StudySchedule[]): Map<number, StudySchedule[]> {
  const grouped = new Map<number, StudySchedule[]>();

  sessions.forEach((session) => {
    const day = session.day_of_week;
    if (!grouped.has(day)) {
      grouped.set(day, []);
    }
    grouped.get(day)!.push(session);
  });

  grouped.forEach((daySessions, day) => {
    grouped.set(
      day,
      daySessions.sort((a, b) => a.start_time.localeCompare(b.start_time))
    );
  });

  return grouped;
}

export function getCycleScheduleByDay(
  userStudy: UserStudy,
  cycleId: string
): Map<number, StudySchedule[]> {
  const sessions = getScheduleSessions(userStudy, cycleId);
  return groupSessionsByDay(sessions);
}

export function sessionExistsInSchedule(userStudy: UserStudy, sessionId: string): boolean {
  const allSessions = getScheduleSessions(userStudy);
  return allSessions.some((s) => s.id === sessionId);
}

export function getSessionById(userStudy: UserStudy, sessionId: string): StudySchedule | null {
  const allSessions = getScheduleSessions(userStudy);
  return allSessions.find((s) => s.id === sessionId) || null;
}
