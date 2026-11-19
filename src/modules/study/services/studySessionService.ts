import { UserStudyService } from '@/services/userStudyService';
import { generateId } from '@/lib/utils';
import { getScheduleSessions } from '../domain/scheduleHelpers';
import { resolveStudySessions, resolveStudyStatistics } from '@/modules/statistics';
import { MIRROR_WEEKLY_STATS } from '../domain/studyWrite';
import type { StudyCycleV2, StudySchedule, UserStudy } from '@/types/userStudy';
import { devLog } from '@/utils/productionLogger';

export interface CompletedSessionInput {
  duration_minutes: number;
  questions: number;
  correct_answers: number;
  notes?: string;
  course_name?: string;
  session_link?: string;
  study_type?: string;
}

export type RecordCompletedSessionResult =
  | { ok: true }
  | { ok: false; reason: 'no_user_data' | 'cycle_not_found' | 'session_not_found' | 'persist_failed' };

function localDateKey(): string {
  const today = new Date();
  return new Date(today.getTime() - today.getTimezoneOffset() * 60000)
    .toISOString()
    .split('T')[0];
}

function findScheduleSession(
  userStudyData: UserStudy,
  cycleId: string,
  dayOfWeek: number,
  sessionId: string
): StudySchedule | null {
  const fromSchedule = userStudyData.study_schedule?.find((s) => s.id === sessionId);
  if (fromSchedule) return fromSchedule;

  return (
    getScheduleSessions(userStudyData, cycleId, dayOfWeek).find((s) => s.id === sessionId) ??
    getScheduleSessions(userStudyData).find((s) => s.id === sessionId) ??
    null
  );
}

function applyStatsIncrement(
  stats: StudySchedule['total_stats'] | undefined,
  completed: CompletedSessionInput,
  localDate: string
): NonNullable<StudySchedule['total_stats']> {
  const current = stats ?? {
    total_duration_minutes: 0,
    total_questions: 0,
    total_correct: 0,
    session_count: 0,
  };

  return {
    total_duration_minutes: current.total_duration_minutes + completed.duration_minutes,
    total_questions: current.total_questions + completed.questions,
    total_correct: current.total_correct + completed.correct_answers,
    session_count: current.session_count + 1,
    last_session_date: localDate,
  };
}

function updateStudyScheduleStats(
  schedule: StudySchedule[],
  sessionId: string,
  completed: CompletedSessionInput,
  localDate: string,
  resolvedSession: StudySchedule
): StudySchedule[] {
  const exists = schedule.some((s) => s.id === sessionId);
  if (!exists) {
    return [
      ...schedule,
      {
        ...resolvedSession,
        day_of_week: resolvedSession.day_of_week,
        total_stats: applyStatsIncrement(undefined, completed, localDate),
        updated_at: new Date().toISOString(),
      },
    ];
  }

  return schedule.map((s) =>
    s.id === sessionId
      ? {
          ...s,
          total_stats: applyStatsIncrement(s.total_stats, completed, localDate),
          updated_at: new Date().toISOString(),
        }
      : s
  );
}

function mirrorWeeklyScheduleStats(
  cycles: StudyCycleV2[],
  cycleId: string,
  dayOfWeek: number,
  sessionId: string,
  completed: CompletedSessionInput,
  localDate: string
): StudyCycleV2[] {
  return cycles.map((c) => {
    if (c.id !== cycleId) return c;

    const updatedScheduleData = { ...c.schedule_data };
    const day = updatedScheduleData.weekly_schedule?.find((d) => d.day === dayOfWeek);

    if (day) {
      const sess = day.sessions.find((s) => s.id === sessionId);
      if (sess) {
        sess.total_stats = applyStatsIncrement(sess.total_stats, completed, localDate);
      }
    }

    return { ...c, schedule_data: updatedScheduleData };
  });
}

/** Registra sessão manual: ledger + total_stats + estatísticas globais. */
export async function recordCompletedSessionForUser(
  userId: string,
  cycleId: string,
  dayOfWeek: number,
  sessionId: string,
  sessionDetails: CompletedSessionInput
): Promise<RecordCompletedSessionResult> {
  try {
    const localDate = localDateKey();

    const userStudyData = await UserStudyService.getUserStudyData(userId);
    if (!userStudyData) return { ok: false, reason: 'no_user_data' };

    const cycle = userStudyData.study_cycles.find((c) => c.id === cycleId);
    if (!cycle) return { ok: false, reason: 'cycle_not_found' };

    const resolvedSession = findScheduleSession(userStudyData, cycleId, dayOfWeek, sessionId);
    if (!resolvedSession) return { ok: false, reason: 'session_not_found' };

    const disciplineName = resolvedSession.discipline_name;
    const blockName = resolvedSession.block_name;

    const newCompletedSession = {
      id: generateId(),
      schedule_session_id: sessionId,
      cycle_id: cycleId,
      date: localDate,
      duration_minutes: sessionDetails.duration_minutes,
      questions: sessionDetails.questions,
      correct_answers: sessionDetails.correct_answers,
      notes: sessionDetails.notes,
      course_name: sessionDetails.course_name,
      session_link: sessionDetails.session_link || resolvedSession.session_link,
      discipline_name: disciplineName,
      block_name: blockName,
      study_type: sessionDetails.study_type || 'manual',
      session_date: localDate,
      start_time: resolvedSession.start_time,
      end_time: resolvedSession.end_time,
      session_count: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const updatedStudySessions = [...(userStudyData.study_sessions || []), newCompletedSession];

    const updatedSchedule = updateStudyScheduleStats(
      userStudyData.study_schedule || [],
      sessionId,
      sessionDetails,
      localDate,
      resolvedSession
    );

    const updatedCycles = MIRROR_WEEKLY_STATS
      ? mirrorWeeklyScheduleStats(
          userStudyData.study_cycles,
          cycleId,
          dayOfWeek,
          sessionId,
          sessionDetails,
          localDate
        )
      : userStudyData.study_cycles;

    const sessionsForStats = resolveStudySessions(
      updatedStudySessions,
      userStudyData.study_statistics
    );
    const calculatedStats = resolveStudyStatistics(
      sessionsForStats,
      userStudyData.study_statistics
    );

    const success = await UserStudyService.upsertUserStudyData(userId, {
      study_sessions: updatedStudySessions,
      study_statistics: calculatedStats,
      study_schedule: updatedSchedule,
      study_cycles: updatedCycles,
    });

    if (!success) return { ok: false, reason: 'persist_failed' };
    return { ok: true };
  } catch (error) {
    devLog.error('recordCompletedSessionForUser failed:', error);
    return { ok: false, reason: 'persist_failed' };
  }
}
