import { describe, it, expect } from 'vitest';
import {
  canInviteMoreStudents,
  computeCoachStudentPerformanceFromStudyData,
  EMPTY_COACH_STUDENT_PERFORMANCE,
  getMaxStudentsForPlan,
  slotsFree,
} from '@/modules/coach';
import type { StudySession, UserStudy } from '@/types/userStudy';
import { defaultUserStudy } from '@/types/userStudy';

const PERIOD_START = new Date(2026, 4, 9); // 2026-05-09 local midnight

function session(partial: Partial<StudySession> & Pick<StudySession, 'id'>): StudySession {
  return {
    duration_minutes: 60,
    questions: 0,
    correct_answers: 0,
    discipline_name: 'Mat',
    ...partial,
  };
}

describe('coachPlanLimits', () => {
  it('maps plan types to max students', () => {
    expect(getMaxStudentsForPlan('starter')).toBe(5);
    expect(getMaxStudentsForPlan('professional')).toBe(10);
    expect(getMaxStudentsForPlan('enterprise')).toBe(25);
  });

  it('computes invite capacity', () => {
    expect(canInviteMoreStudents(4, 5)).toBe(true);
    expect(canInviteMoreStudents(5, 5)).toBe(false);
    expect(slotsFree(3, 10)).toBe(7);
  });
});

describe('computeCoachStudentPerformanceFromStudyData', () => {
  it('returns empty snapshot when study data is null', () => {
    expect(computeCoachStudentPerformanceFromStudyData(null)).toEqual(
      EMPTY_COACH_STUDENT_PERFORMANCE
    );
  });

  it('returns zeros when study data has no sessions', () => {
    const data: UserStudy = {
      ...defaultUserStudy,
      study_sessions: [],
    };
    const result = computeCoachStudentPerformanceFromStudyData(data, {
      periodStart: PERIOD_START,
    });
    expect(result.hours_this_week).toBe(0);
    expect(result.sessions_this_week).toBe(0);
    expect(result.engagement_score).toBe(0);
  });

  it('counts sessions within the 7-day period', () => {
    const data: UserStudy = {
      ...defaultUserStudy,
      study_sessions: [
        session({ id: 'a', date: '2026-05-10', duration_minutes: 120 }),
        session({ id: 'b', date: '2026-05-01', duration_minutes: 60 }),
      ],
    };
    const result = computeCoachStudentPerformanceFromStudyData(data, {
      periodStart: PERIOD_START,
    });
    expect(result.sessions_this_week).toBe(1);
    expect(result.hours_this_week).toBe(2);
    expect(result.tasks_completed).toBe(1);
  });

  it('caps engagement_score at 10 for heavy study weeks', () => {
    const data: UserStudy = {
      ...defaultUserStudy,
      study_sessions: [
        session({ id: 'a', date: '2026-05-10', duration_minutes: 600 }),
        session({ id: 'b', date: '2026-05-11', duration_minutes: 600 }),
      ],
    };
    const result = computeCoachStudentPerformanceFromStudyData(data, {
      periodStart: PERIOD_START,
    });
    expect(result.engagement_score).toBe(10);
  });

  it('computes completion_rate as share of sessions in period', () => {
    const data: UserStudy = {
      ...defaultUserStudy,
      study_sessions: [
        session({ id: 'a', date: '2026-05-10', duration_minutes: 60 }),
        session({ id: 'b', date: '2026-05-11', duration_minutes: 60 }),
        session({ id: 'c', date: '2026-04-01', duration_minutes: 60 }),
        session({ id: 'd', date: '2026-04-02', duration_minutes: 60 }),
      ],
    };
    const result = computeCoachStudentPerformanceFromStudyData(data, {
      periodStart: PERIOD_START,
    });
    expect(result.completion_rate).toBe(50);
  });
});
