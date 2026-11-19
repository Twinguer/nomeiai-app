import type { PrivacyLevel } from './types';

export function isPublicGroup(privacyLevel: PrivacyLevel | string | undefined): boolean {
  return privacyLevel === 'public';
}

export function isPrivateGroup(privacyLevel: PrivacyLevel | string | undefined): boolean {
  return privacyLevel === 'private' || privacyLevel === 'invite_only';
}

export function getPrivacyLabel(privacyLevel: PrivacyLevel | string | undefined): string {
  if (privacyLevel === 'public') return 'Público';
  if (privacyLevel === 'invite_only') return 'Apenas convite';
  return 'Privado';
}

export function canRequestToJoinGroup(privacyLevel: PrivacyLevel | string | undefined): boolean {
  return isPublicGroup(privacyLevel);
}
