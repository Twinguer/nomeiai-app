import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserStudy } from '@/types/userStudy';
import {
  buildUpdatedTimerDayTaskCompletions,
  parseTimerDayTaskCompletions,
  pruneTimerDayCompletedTaskIds,
  readTimerDayCompletedTaskIdsFromLocalStorage,
  resolveTimerDayCompletedTaskIds,
  setsEqual,
  trimTimerDayTaskCompletions,
  writeTimerDayCompletedTaskIdsToLocalStorage,
} from '@/utils/timerDayTaskCompletion';

function createMemoryStorage(): Storage {
  const store = new Map<string, string>();

  return {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key: string) => store.get(key) ?? null,
    key: (index: number) => [...store.keys()][index] ?? null,
    removeItem: (key: string) => {
      store.delete(key);
    },
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
  };
}

describe('timerDayTaskCompletion', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createMemoryStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('persiste e lê checks locais por usuário, ciclo e data', () => {
    const dateKey = '2026-05-19';

    writeTimerDayCompletedTaskIdsToLocalStorage(
      'user-1',
      'cycle-1',
      new Set(['task-a', 'task-b']),
      dateKey
    );

    expect(readTimerDayCompletedTaskIdsFromLocalStorage('user-1', 'cycle-1', dateKey)).toEqual(
      new Set(['task-a', 'task-b'])
    );
  });

  it('resolve checks priorizando servidor e completando com local', () => {
    const userStudy = {
      timer_day_task_completions: {
        '2026-05-19': {
          'cycle-1': ['task-a'],
        },
      },
    } as UserStudy;

    writeTimerDayCompletedTaskIdsToLocalStorage(
      'user-1',
      'cycle-1',
      new Set(['task-b']),
      '2026-05-19'
    );

    const resolved = resolveTimerDayCompletedTaskIds({
      userStudy,
      ownerUserId: 'user-1',
      cycleId: 'cycle-1',
      validTaskIds: ['task-a', 'task-b', 'task-c'],
      dateKey: '2026-05-19',
    });

    expect(resolved).toEqual(new Set(['task-a', 'task-b']));
  });

  it('remove ids inválidos ao podar tarefas do dia', () => {
    const pruned = pruneTimerDayCompletedTaskIds(
      new Set(['task-a', 'task-old']),
      ['task-a', 'task-b']
    );

    expect(pruned).toEqual(new Set(['task-a']));
  });

  it('atualiza mapa de conclusões por data e ciclo', () => {
    const updated = buildUpdatedTimerDayTaskCompletions(undefined, 'cycle-1', new Set(['task-a']), '2026-05-19');

    expect(updated).toEqual({
      '2026-05-19': {
        'cycle-1': ['task-a'],
      },
    });
  });

  it('remove datas antigas ao podar mapa', () => {
    const trimmed = trimTimerDayTaskCompletions(
      {
        '2026-05-01': { 'cycle-1': ['old'] },
        '2026-05-19': { 'cycle-1': ['task-a'] },
      },
      '2026-05-19'
    );

    expect(trimmed).toEqual({
      '2026-05-19': { 'cycle-1': ['task-a'] },
    });
  });

  it('parseia metadata do servidor com segurança', () => {
    expect(parseTimerDayTaskCompletions(null)).toEqual({});
    expect(
      parseTimerDayTaskCompletions({
        '2026-05-19': {
          'cycle-1': ['task-a', 123, ''],
        },
      })
    ).toEqual({
      '2026-05-19': {
        'cycle-1': ['task-a'],
      },
    });
  });

  it('compara sets corretamente', () => {
    expect(setsEqual(new Set(['a']), new Set(['a']))).toBe(true);
    expect(setsEqual(new Set(['a']), new Set(['b']))).toBe(false);
  });
});
