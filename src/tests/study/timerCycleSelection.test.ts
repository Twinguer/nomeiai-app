import { describe, expect, it } from 'vitest';
import { resolveInitialTimerCycleId } from '@/utils/timerCycleSelection';

describe('resolveInitialTimerCycleId', () => {
  const availableCycleIds = ['cycle-a', 'cycle-b', 'cycle-c'];

  it('prioriza o ciclo da tarefa pendente', () => {
    expect(
      resolveInitialTimerCycleId({
        pendingTaskCycleId: 'cycle-b',
        secureCycleId: 'cycle-a',
        storedCycleId: 'cycle-c',
        availableCycleIds,
      })
    ).toBe('cycle-b');
  });

  it('usa o ciclo seguro quando não há tarefa pendente', () => {
    expect(
      resolveInitialTimerCycleId({
        secureCycleId: 'cycle-c',
        storedCycleId: 'cycle-b',
        availableCycleIds,
      })
    ).toBe('cycle-c');
  });

  it('usa o ciclo salvo quando não há contexto explícito', () => {
    expect(
      resolveInitialTimerCycleId({
        storedCycleId: 'cycle-b',
        availableCycleIds,
      })
    ).toBe('cycle-b');
  });

  it('cai no primeiro ciclo disponível como fallback', () => {
    expect(
      resolveInitialTimerCycleId({
        availableCycleIds,
      })
    ).toBe('cycle-a');
  });
});
