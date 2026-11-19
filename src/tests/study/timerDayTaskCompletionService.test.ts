import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rpc } = vi.hoisted(() => ({
  rpc: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc },
}));

vi.mock('@/services/userStudyService', () => ({
  UserStudyService: {
    clearCache: vi.fn(),
  },
}));

import { UserStudyService } from '@/services/userStudyService';
import { persistTimerDayTaskCompletions } from '@/modules/study/services/timerDayTaskCompletionService';

describe('persistTimerDayTaskCompletions', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      key: vi.fn(),
      length: 0,
    });
    rpc.mockReset();
  });

  it('salva localmente e sincroniza via RPC', async () => {
    rpc.mockResolvedValue({ data: true, error: null });

    await expect(
      persistTimerDayTaskCompletions({
        ownerUserId: 'user-1',
        cycleId: 'cycle-1',
        taskIds: new Set(['task-a']),
        dateKey: '2026-05-19',
      })
    ).resolves.toBe(true);

    expect(rpc).toHaveBeenCalledWith('patch_timer_day_task_completions', {
      p_user_id: 'user-1',
      p_date_key: '2026-05-19',
      p_cycle_id: 'cycle-1',
      p_task_ids: ['task-a'],
    });
    expect(UserStudyService.clearCache).toHaveBeenCalledWith('user-1');
  });

  it('retorna false quando RPC falha', async () => {
    rpc.mockResolvedValue({ data: false, error: null });

    await expect(
      persistTimerDayTaskCompletions({
        ownerUserId: 'user-1',
        cycleId: 'cycle-1',
        taskIds: new Set(['task-a']),
        dateKey: '2026-05-19',
      })
    ).resolves.toBe(false);
  });
});
