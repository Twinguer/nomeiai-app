import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { UserStudy } from '@/types/userStudy';
import { defaultUserStudy } from '@/types/userStudy';

const mockGetUserStudyData = vi.fn();
const mockUpsertUserStudyData = vi.fn();

vi.mock('@/services/userStudyService', () => ({
  UserStudyService: {
    getUserStudyData: (...args: unknown[]) => mockGetUserStudyData(...args),
    upsertUserStudyData: (...args: unknown[]) => mockUpsertUserStudyData(...args),
  },
}));

vi.mock('@/lib/utils', () => ({
  generateId: vi.fn(() => 'ledger-entry-1'),
}));

const mockMirror = vi.hoisted(() => ({ value: false }));
vi.mock('@/modules/study/domain/studyWrite', () => ({
  get MIRROR_WEEKLY_STATS() {
    return mockMirror.value;
  },
}));

import { recordCompletedSessionForUser } from '@/modules/study';

function baseUserStudy(overrides: Partial<UserStudy> = {}): UserStudy {
  return {
    ...defaultUserStudy,
    id: 'row-1',
    user_id: 'user-1',
    study_sessions: [],
    study_schedule: [
      {
        id: 'task-1',
        cycle_id: 'cycle-1',
        day_of_week: 1,
        start_time: '09:00',
        end_time: '10:00',
        discipline_name: 'Direito',
        block_name: 'Bloco A',
        total_stats: {
          session_count: 1,
          total_duration_minutes: 30,
          total_questions: 5,
          total_correct: 4,
        },
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    ],
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
              day: 1,
              sessions: [
                {
                  id: 'task-1',
                  start_time: '09:00',
                  end_time: '10:00',
                  discipline_name: 'Direito',
                  block_name: 'Bloco A',
                  total_stats: {
                    session_count: 1,
                    total_duration_minutes: 30,
                    total_questions: 5,
                    total_correct: 4,
                  },
                },
              ],
            },
          ],
          available_blocks: [],
          available_disciplines: [],
        },
        created_at: '2026-01-01T00:00:00Z',
      },
    ],
    study_statistics: {
      ...defaultUserStudy.study_statistics!,
      totalHours: 0.5,
      totalSessions: 1,
      questionsAnswered: 5,
      correctAnswers: 4,
    },
    ...overrides,
  };
}

describe('recordCompletedSessionForUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMirror.value = false;
    mockUpsertUserStudyData.mockResolvedValue(true);
  });

  it('returns no_user_data when user study row is missing', async () => {
    mockGetUserStudyData.mockResolvedValue(null);

    const result = await recordCompletedSessionForUser('user-1', 'cycle-1', 1, 'task-1', {
      duration_minutes: 60,
      questions: 10,
      correct_answers: 8,
    });

    expect(result).toEqual({ ok: false, reason: 'no_user_data' });
    expect(mockUpsertUserStudyData).not.toHaveBeenCalled();
  });

  it('returns cycle_not_found when cycle id is invalid', async () => {
    mockGetUserStudyData.mockResolvedValue(baseUserStudy());

    const result = await recordCompletedSessionForUser('user-1', 'missing-cycle', 1, 'task-1', {
      duration_minutes: 60,
      questions: 10,
      correct_answers: 8,
    });

    expect(result).toEqual({ ok: false, reason: 'cycle_not_found' });
  });

  it('returns session_not_found when task id is invalid', async () => {
    mockGetUserStudyData.mockResolvedValue(baseUserStudy());

    const result = await recordCompletedSessionForUser('user-1', 'cycle-1', 1, 'missing-task', {
      duration_minutes: 60,
      questions: 10,
      correct_answers: 8,
    });

    expect(result).toEqual({ ok: false, reason: 'session_not_found' });
  });

  it('persists ledger, schedule stats and global statistics', async () => {
    mockGetUserStudyData.mockResolvedValue(baseUserStudy());

    const result = await recordCompletedSessionForUser('user-1', 'cycle-1', 1, 'task-1', {
      duration_minutes: 45,
      questions: 10,
      correct_answers: 7,
      notes: 'Revisão',
      course_name: 'Constitucional',
      study_type: 'pdf',
    });

    expect(result).toEqual({ ok: true });
    expect(mockUpsertUserStudyData).toHaveBeenCalledTimes(1);

    const payload = mockUpsertUserStudyData.mock.calls[0][1];
    expect(payload.study_sessions).toHaveLength(1);
    expect(payload.study_sessions[0]).toMatchObject({
      id: 'ledger-entry-1',
      schedule_session_id: 'task-1',
      cycle_id: 'cycle-1',
      duration_minutes: 45,
      questions: 10,
      correct_answers: 7,
      discipline_name: 'Direito',
      block_name: 'Bloco A',
    });

    const task = payload.study_schedule.find((s: { id: string }) => s.id === 'task-1');
    expect(task.total_stats).toMatchObject({
      total_duration_minutes: 75,
      total_questions: 15,
      total_correct: 11,
      session_count: 2,
    });

    expect(payload.study_statistics.totalHours).toBeGreaterThan(0);
    expect(payload.study_statistics.questionsAnswered).toBe(10);
    expect(payload.study_statistics.correctAnswers).toBe(7);
  });

  it('does not mirror weekly_schedule when MIRROR_WEEKLY_STATS is false', async () => {
    mockMirror.value = false;
    mockGetUserStudyData.mockResolvedValue(baseUserStudy());

    await recordCompletedSessionForUser('user-1', 'cycle-1', 1, 'task-1', {
      duration_minutes: 20,
      questions: 0,
      correct_answers: 0,
    });

    const payload = mockUpsertUserStudyData.mock.calls[0][1];
    const weeklyTask = payload.study_cycles[0].schedule_data.weekly_schedule[0].sessions[0];
    expect(weeklyTask.total_stats).toMatchObject({
      total_duration_minutes: 30,
      total_questions: 5,
      session_count: 1,
    });
  });

  it('mirrors weekly_schedule when MIRROR_WEEKLY_STATS is true', async () => {
    mockMirror.value = true;
    mockGetUserStudyData.mockResolvedValue(baseUserStudy());

    await recordCompletedSessionForUser('user-1', 'cycle-1', 1, 'task-1', {
      duration_minutes: 20,
      questions: 2,
      correct_answers: 1,
    });

    const payload = mockUpsertUserStudyData.mock.calls[0][1];
    const weeklyTask = payload.study_cycles[0].schedule_data.weekly_schedule[0].sessions[0];
    expect(weeklyTask.total_stats).toMatchObject({
      total_duration_minutes: 50,
      total_questions: 7,
      total_correct: 5,
      session_count: 2,
    });
  });

  it('resolves session from weekly_schedule fallback when study_schedule is empty', async () => {
    const legacyOnly = baseUserStudy({ study_schedule: [] });
    mockGetUserStudyData.mockResolvedValue(legacyOnly);

    const result = await recordCompletedSessionForUser('user-1', 'cycle-1', 1, 'task-1', {
      duration_minutes: 15,
      questions: 3,
      correct_answers: 2,
    });

    expect(result).toEqual({ ok: true });
    const payload = mockUpsertUserStudyData.mock.calls[0][1];
    expect(payload.study_schedule).toHaveLength(1);
    expect(payload.study_schedule[0].id).toBe('task-1');
    expect(payload.study_schedule[0].total_stats.total_duration_minutes).toBe(15);
  });
});
