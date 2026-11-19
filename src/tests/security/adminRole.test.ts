import { describe, expect, it, vi, beforeEach } from 'vitest';

const { rpc } = vi.hoisted(() => ({
  rpc: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc,
  },
}));

import { checkIsPlatformAdmin, fetchCurrentUserPlatformRole } from '@/utils/adminRole';

describe('fetchCurrentUserPlatformRole', () => {
  beforeEach(() => {
    rpc.mockReset();
  });

  it('retorna a role via RPC', async () => {
    rpc.mockResolvedValue({ data: 'admin', error: null });
    await expect(fetchCurrentUserPlatformRole()).resolves.toBe('admin');
    expect(rpc).toHaveBeenCalledWith('get_current_user_role');
  });

  it('retorna null quando não há role', async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    await expect(fetchCurrentUserPlatformRole()).resolves.toBeNull();
  });

  it('retorna null em erro', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'fail' } });
    await expect(fetchCurrentUserPlatformRole()).resolves.toBeNull();
  });
});

describe('checkIsPlatformAdmin', () => {
  beforeEach(() => {
    rpc.mockReset();
  });

  it('retorna true quando a role é admin', async () => {
    rpc.mockResolvedValue({ data: 'admin', error: null });
    await expect(checkIsPlatformAdmin()).resolves.toBe(true);
  });

  it('retorna false quando a role não é admin', async () => {
    rpc.mockResolvedValue({ data: 'user', error: null });
    await expect(checkIsPlatformAdmin()).resolves.toBe(false);
  });

  it('retorna false quando não há role', async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    await expect(checkIsPlatformAdmin()).resolves.toBe(false);
  });
});
