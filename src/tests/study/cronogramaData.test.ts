import { describe, it, expect } from 'vitest';
import { mapScheduleToCronogramaSessions } from '@/modules/study';
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

describe('mapScheduleToCronogramaSessions', () => {
  it('maps active cycle tasks to UI sessions', () => {
    const data = minimalUserStudy({
      study_schedule: [
        {
          id: 'task-1',
          cycle_id: 'cycle-1',
          day_of_week: 1,
          duration_minutes: 90,
          display_order: 2,
          discipline_name: 'Mat',
          block_name: 'Bloco A',
          session_link: 'https://exemplo.com',
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
            weekly_schedule: [],
            available_blocks: [],
            available_disciplines: [],
          },
          created_at: '2026-01-01',
        },
      ],
    });

    const sessions = mapScheduleToCronogramaSessions(data);
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({
      id: 'task-1',
      cycleId: 'cycle-1',
      day: 1,
      durationMinutes: 90,
      displayOrder: 2,
      disciplineName: 'Mat',
      blockName: 'Bloco A',
      sessionLink: 'https://exemplo.com',
    });
  });

  it('skips tasks from inactive cycles', () => {
    const data = minimalUserStudy({
      study_schedule: [
        {
          id: 'task-1',
          cycle_id: 'cycle-off',
          day_of_week: 0,
          discipline_name: 'X',
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
          id: 'cycle-off',
          cycle_name: 'Inativo',
          exam_date: '2026-12-01',
          is_active: false,
          schedule_data: {
            metadata: { total_sessions: 0, total_hours: 0 },
            weekly_schedule: [],
            available_blocks: [],
            available_disciplines: [],
          },
          created_at: '2026-01-01',
        },
      ],
    });

    expect(mapScheduleToCronogramaSessions(data)).toHaveLength(0);
  });
});
