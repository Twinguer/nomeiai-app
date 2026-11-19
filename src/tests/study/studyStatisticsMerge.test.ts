import { describe, it, expect } from 'vitest';
import {
  resolveStudySessions,
  resolveUserStudyStatisticsFromData,
} from '@/modules/statistics';
import type { StudySession, UserStudy } from '@/types/userStudy';
import { defaultUserStudy } from '@/types/userStudy';

describe('resolveStudySessions', () => {
  it('returns empty when no sessions and no history', () => {
    expect(resolveStudySessions([], null)).toEqual([]);
  });

  it('imports sessionHistory when study_sessions is empty', () => {
    const history = [
      {
        date: '2026-05-01',
        duration: 60,
        type: 'manual' as const,
        subject: 'Mat',
        questions: 10,
        correctAnswers: 8,
      },
    ];
    const sessions = resolveStudySessions([], {
      ...defaultUserStudy.study_statistics!,
      sessionHistory: history,
    });
    expect(sessions).toHaveLength(1);
    expect(sessions[0].duration_minutes).toBe(60);
    expect(sessions[0].discipline_name).toBe('Mat');
  });

  it('does not duplicate ledger entries already in study_sessions', () => {
    const ledger: StudySession[] = [
      {
        id: 's1',
        duration_minutes: 60,
        questions: 10,
        correct_answers: 8,
        session_date: '2026-05-01',
        discipline_name: 'Mat',
        study_type: 'manual',
        session_count: 1,
        start_time: '09:00:00',
        created_at: '2026-05-01',
      },
    ];
    const history = [
      {
        date: '2026-05-01',
        duration: 60,
        type: 'manual' as const,
        subject: 'Mat',
        questions: 10,
        correctAnswers: 8,
      },
    ];
    const merged = resolveStudySessions(ledger, {
      ...defaultUserStudy.study_statistics!,
      sessionHistory: history,
    });
    expect(merged).toHaveLength(1);
  });
});

describe('resolveUserStudyStatisticsFromData', () => {
  it('returns default stats for null input', () => {
    const stats = resolveUserStudyStatisticsFromData(null);
    expect(stats.totalHours).toBe(0);
    expect(stats.totalSessions).toBe(0);
  });

  it('calculates from study_sessions ledger', () => {
    const data: Partial<UserStudy> = {
      study_sessions: [
        {
          id: 's1',
          duration_minutes: 120,
          questions: 20,
          correct_answers: 15,
          session_date: '2026-05-01',
          discipline_name: 'Mat',
          study_type: 'manual',
          session_count: 1,
          start_time: '09:00:00',
          created_at: '2026-05-01',
        },
      ],
      study_statistics: defaultUserStudy.study_statistics!,
    };
    const stats = resolveUserStudyStatisticsFromData(data as UserStudy);
    expect(stats.totalHours).toBe(2);
    expect(stats.questionsAnswered).toBe(20);
    expect(stats.correctAnswers).toBe(15);
  });
});
