import { describe, it, expect } from 'vitest';
import { getScheduleSessions } from '@/modules/study';
import type { UserStudy } from '@/types/userStudy';

function minimalUserStudy(overrides: Partial<UserStudy> = {}): UserStudy {
  return {
    id: 'row-1',
    user_id: 'user-1',
    study_sessions: [],
    study_schedule: [],
    study_statistics: {} as UserStudy['study_statistics'],
    study_cycles: [],
    study_plans: [],
    study_subjects: [],
    study_goals: [],
    study_goals_tracking: {},
    study_progress: [],
    study_reminders: [],
    spaced_repetition_queue: [],
    user_study_days: [],
    study_contests: [],
    total_sessions_count: 0,
    total_schedule_count: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('getScheduleSessions', () => {
  it('returns study_schedule when present', () => {
    const data = minimalUserStudy({
      study_schedule: [
        {
          id: 'task-1',
          cycle_id: 'cycle-1',
          day_of_week: 1,
          start_time: '09:00',
          end_time: '10:00',
          discipline_name: 'Mat',
          block_name: 'A',
          total_stats: {
            session_count: 0,
            total_duration_minutes: 0,
            total_questions: 0,
            total_correct: 0,
          },
          created_at: '2026-01-01',
          updated_at: '2026-01-01',
        },
      ],
    });

    const sessions = getScheduleSessions(data);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].id).toBe('task-1');
    expect(sessions[0].discipline_name).toBe('Mat');
  });

  it('falls back to weekly_schedule when study_schedule is empty', () => {
    const data = minimalUserStudy({
      study_cycles: [
        {
          id: 'cycle-1',
          cycle_name: 'Ciclo 1',
          exam_date: '2026-12-01',
          is_active: true,
          schedule_data: {
            metadata: { total_sessions: 1, total_hours: 0 },
            weekly_schedule: [
              {
                day: 2,
                sessions: [
                  {
                    id: 'legacy-1',
                    start_time: '08:00',
                    end_time: '09:00',
                    discipline_name: 'Port',
                    block_name: 'B',
                    total_stats: {
                      total_duration_minutes: 60,
                      total_questions: 10,
                      total_correct: 8,
                      session_count: 1,
                    },
                  },
                ],
              },
            ],
            available_blocks: [],
            available_disciplines: [],
          },
          created_at: '2026-01-01',
        },
      ],
    });

    const sessions = getScheduleSessions(data);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].id).toBe('legacy-1');
    expect(sessions[0].cycle_id).toBe('cycle-1');
    expect(sessions[0].day_of_week).toBe(2);
  });

  it('prefers study_schedule over weekly_schedule when both exist', () => {
    const data = minimalUserStudy({
      study_schedule: [
        {
          id: 'new-1',
          cycle_id: 'cycle-1',
          day_of_week: 0,
          start_time: '10:00',
          end_time: '11:00',
          discipline_name: 'New',
          total_stats: {
            session_count: 0,
            total_duration_minutes: 0,
            total_questions: 0,
            total_correct: 0,
          },
          created_at: '2026-01-01',
          updated_at: '2026-01-01',
        },
      ],
      study_cycles: [
        {
          id: 'cycle-1',
          cycle_name: 'Ciclo',
          exam_date: '2026-12-01',
          is_active: true,
          schedule_data: {
            metadata: { total_sessions: 1, total_hours: 0 },
            weekly_schedule: [
              {
                day: 0,
                sessions: [
                  {
                    id: 'old-1',
                    start_time: '08:00',
                    end_time: '09:00',
                    discipline_name: 'Old',
                    block_name: 'X',
                  },
                ],
              },
            ],
            available_blocks: [],
            available_disciplines: [],
          },
          created_at: '2026-01-01',
        },
      ],
    });

    const sessions = getScheduleSessions(data);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].id).toBe('new-1');
  });

  it('filters by cycle_id and day_of_week', () => {
    const data = minimalUserStudy({
      study_schedule: [
        {
          id: 'a',
          cycle_id: 'c1',
          day_of_week: 1,
          start_time: '09:00',
          end_time: '10:00',
          total_stats: {
            session_count: 0,
            total_duration_minutes: 0,
            total_questions: 0,
            total_correct: 0,
          },
          created_at: '2026-01-01',
          updated_at: '2026-01-01',
        },
        {
          id: 'b',
          cycle_id: 'c2',
          day_of_week: 1,
          start_time: '09:00',
          end_time: '10:00',
          total_stats: {
            session_count: 0,
            total_duration_minutes: 0,
            total_questions: 0,
            total_correct: 0,
          },
          created_at: '2026-01-01',
          updated_at: '2026-01-01',
        },
      ],
    });

    expect(getScheduleSessions(data, 'c1')).toHaveLength(1);
    expect(getScheduleSessions(data, 'c1', 1)[0].id).toBe('a');
    expect(getScheduleSessions(data, undefined, 1)).toHaveLength(2);
  });
});
