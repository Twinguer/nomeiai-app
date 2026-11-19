import { describe, expect, it } from 'vitest';
import {
  getDayTasksForCycle,
  sortDayTasks,
  type CronogramaStudySession,
} from '@/modules/study/hooks/useCronogramaData';
import type { UserStudy } from '@/types/userStudy';

const baseTask = (
  overrides: Partial<CronogramaStudySession> & Pick<CronogramaStudySession, 'id'>
): CronogramaStudySession => ({
  day: 1,
  disciplineName: 'Direito',
  blockName: 'Bloco A',
  cycleId: 'cycle-1',
  ...overrides,
});

describe('sortDayTasks', () => {
  it('ordena por displayOrder e depois por horário', () => {
    const sorted = sortDayTasks([
      baseTask({ id: 'b', startTime: '10:00', displayOrder: 1 }),
      baseTask({ id: 'a', startTime: '08:00', displayOrder: 0 }),
      baseTask({ id: 'c', durationMinutes: 60, displayOrder: 1 }),
    ]);

    expect(sorted.map((t) => t.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('getDayTasksForCycle', () => {
  const userStudy = {
    study_cycles: [
      {
        id: 'cycle-1',
        is_active: true,
        cycle_name: 'Ciclo 1',
      },
    ],
    study_schedule: [
      {
        id: 'task-mon',
        cycle_id: 'cycle-1',
        day_of_week: 1,
        discipline_name: 'Português',
        block_name: 'Bloco 1',
        display_order: 0,
        duration_minutes: 90,
        created_at: '',
        updated_at: '',
      },
      {
        id: 'task-tue',
        cycle_id: 'cycle-1',
        day_of_week: 2,
        discipline_name: 'Matemática',
        block_name: 'Bloco 2',
        display_order: 0,
        duration_minutes: 60,
        created_at: '',
        updated_at: '',
      },
    ],
  } as unknown as UserStudy;

  it('retorna apenas tarefas do ciclo e dia informados', () => {
    const tasks = getDayTasksForCycle(userStudy, 'cycle-1', 1);

    expect(tasks).toHaveLength(1);
    expect(tasks[0].id).toBe('task-mon');
    expect(tasks[0].disciplineName).toBe('Português');
  });

  it('retorna vazio sem ciclo ou dados', () => {
    expect(getDayTasksForCycle(null, 'cycle-1', 1)).toEqual([]);
    expect(getDayTasksForCycle(userStudy, null, 1)).toEqual([]);
  });
});
