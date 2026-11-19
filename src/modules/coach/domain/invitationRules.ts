import type { CoachSubscriptionStatus, InvitationStatus } from './types';

export function isInvitationPending(status: InvitationStatus): boolean {
  return status === 'pending';
}

export function isInvitationExpired(expiresAt: string, now: Date = new Date()): boolean {
  return new Date(expiresAt).getTime() < now.getTime();
}

/** Convite ainda pode ser aceito ou rejeitado pelo aluno. */
export function canRespondToInvitation(
  status: InvitationStatus,
  expiresAt: string,
  now: Date = new Date()
): boolean {
  return isInvitationPending(status) && !isInvitationExpired(expiresAt, now);
}

export function isCoachSubscriptionActive(
  status: CoachSubscriptionStatus,
  expiresAt: string | null,
  now: Date = new Date()
): boolean {
  if (status !== 'active') {
    return false;
  }
  if (!expiresAt) {
    return true;
  }
  return new Date(expiresAt).getTime() + 5 * 24 * 60 * 60 * 1000 > now.getTime();
}

export function effectiveInvitationStatus(
  status: InvitationStatus,
  expiresAt: string,
  now: Date = new Date()
): InvitationStatus {
  if (isInvitationPending(status) && isInvitationExpired(expiresAt, now)) {
    return 'expired';
  }
  return status;
}
