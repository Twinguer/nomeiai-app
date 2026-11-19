import { describe, it, expect, vi, beforeEach } from 'vitest';
import { coachInvitationService } from '@/modules/coach/services/coachInvitationService';

const rpcMock = vi.fn();
const fromMock = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpcMock(...args),
    from: (...args: unknown[]) => fromMock(...args),
  },
}));

vi.mock('@/utils/secureLogger', () => ({
  logError: vi.fn(),
  logWarn: vi.fn(),
}));

describe('coachInvitationService', () => {
  beforeEach(() => {
    rpcMock.mockReset();
    fromMock.mockReset();
  });

  it('sendInvitation calls RPC with coach params', async () => {
    rpcMock.mockResolvedValue({ data: { success: true }, error: null });

    const result = await coachInvitationService.sendInvitation(
      'coach-1',
      'aluno123',
      'Olá!'
    );

    expect(rpcMock).toHaveBeenCalledWith('send_coach_invitation', {
      p_coach_id: 'coach-1',
      p_student_nickname: 'aluno123',
      p_invitation_message: 'Olá!',
    });
    expect(result.success).toBe(true);
  });

  it('cancelInvitation throws when RPC returns success false', async () => {
    rpcMock.mockResolvedValue({
      data: { success: false, error: 'Convite não encontrado' },
      error: null,
    });

    await expect(
      coachInvitationService.cancelInvitation('coach-1', 'inv-1')
    ).rejects.toThrow('Convite não encontrado');
  });

  it('searchUsersForInvite generates nickname when missing', async () => {
    fromMock.mockReturnValue({
      select: vi.fn().mockReturnValue({
        or: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({
            data: [{ id: 'u1', name: 'Ana Silva', nickname: null, avatar_url: null }],
            error: null,
          }),
        }),
      }),
    });

    const results = await coachInvitationService.searchUsersForInvite('ana');
    expect(results[0].nickname).toBe('anasilva');
  });

  it('fetchPendingInvitations enriches student profile', async () => {
    const orderMock = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'inv-1',
          coach_id: 'coach-1',
          student_id: 'student-1',
          student_email: 'a@test.com',
          status: 'pending',
          invited_at: '2026-05-01',
        },
      ],
      error: null,
    });

    fromMock.mockImplementation((table: string) => {
      if (table === 'coach_invitations_history') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: orderMock,
              }),
            }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { name: 'Aluno Teste', nickname: 'aluno', avatar_url: null },
              error: null,
            }),
          }),
        }),
      };
    });

    const invitations = await coachInvitationService.fetchPendingInvitations('coach-1');
    expect(invitations[0].student_name).toBe('Aluno Teste');
  });
});
