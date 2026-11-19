import { describe, expect, it } from 'vitest';
import {
  formatTaskProgressLabel,
  getTodayStudiedMinutesByTaskId,
  resolvePlannedMinutes,
} from '@/modules/study/domain/timerDayTaskProgress';
import type { CronogramaStudySession } from '@/modules/study/hooks/useCronogramaData';
import type { StudySession } from '@/types/userStudy';

const task = (overrides: Partial<CronogramaStudySession> = {}): CronogramaStudySession => ({
  id: 'task-1',
  day: 1,
  disciplineName: 'Português',
  blockName: 'Bloco 1',
  cycleId: 'cycle-1',
  durationMinutes: 90,
  ...overrides,
});

describe('getTodayStudiedMinutesByTaskId', () => {
  it('soma minutos do dia por schedule_session_id', () => {
    const sessions = [
      {
        schedule_session_id: 'task-1',
        cycle_id: 'cycle-1',
        date: '2026-06-07',
        duration_minutes: 30,
      },
      {
        schedule_session_id: 'task-1',
        cycle_id: 'cycle-1',
        date: '2026-06-07',
        duration_minutes: 15,
      },
      {
        schedule_session_id: 'task-2',
        cycle_id: 'cycle-1',
        date: '2026-06-07',
        duration_minutes: 60,
      },
      {
        schedule_session_id: 'task-1',
        cycle_id: 'cycle-1',
        date: '2026-06-06',
        duration_minutes: 120,
      },
    ] as StudySession[];

    expect(
      getTodayStudiedMinutesByTaskId(sessions, {
        dateKey: '2026-06-07',
        cycleId: 'cycle-1',
      })
    ).toEqual({
      'task-1': 45,
      'task-2': 60,
    });
  });
});

describe('resolvePlannedMinutes', () => {
  it('usa durationMinutes quando disponível', () => {
    expect(resolvePlannedMinutes(task())).toBe(90);
  });

  it('calcula a partir de horário fixo', () => {
    expect(
      resolvePlannedMinutes(
        task({
          durationMinutes: undefined,
          startTime: '08:00',
          endTime: '09:30',
        })
      )
    ).toBe(90);
  });
});

describe('formatTaskProgressLabel', () => {
  it('mostra planejado e feito', () => {
    expect(formatTaskProgressLabel(task(), 45)).toBe('90 min planejado · 45 min feito');
  });

  it('deriva meta planejada do intervalo de horário', () => {
    expect(
      formatTaskProgressLabel(
        task({
          durationMinutes: undefined,
          startTime: '08:00',
          endTime: '09:00',
        }),
        30
      )
    ).toBe('60 min planejado · 30 min feito');
  });
});
