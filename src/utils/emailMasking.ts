/**
 * Email masking utility for privacy protection
 * Masks email addresses to prevent exposure in public profiles
 */

export const maskEmail = (email: string | null | undefined): string => {
  if (!email || typeof email !== 'string') {
    return 'Email não disponível';
  }

  // Check if email is valid format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return 'Email inválido';
  }

  const [localPart, domain] = email.split('@');
  
  // Mask local part
  const maskedLocal = localPart.length > 2 
    ? `${localPart[0]}***${localPart[localPart.length - 1]}`
    : '***';
  
  // Mask domain
  const [domainName, ...tld] = domain.split('.');
  const maskedDomain = domainName.length > 2
    ? `${domainName[0]}***${domainName[domainName.length - 1]}`
    : '***';
  
  return `${maskedLocal}@${maskedDomain}.${tld.join('.')}`;
};

/**
 * Checks if user has permission to view full email
 */
export const canViewFullEmail = (
  viewerId: string | null | undefined,
  profileOwnerId: string | null | undefined
): boolean => {
  if (!viewerId || !profileOwnerId) return false;
  return viewerId === profileOwnerId;
};
