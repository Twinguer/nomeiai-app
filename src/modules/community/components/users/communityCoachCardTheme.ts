import type { CSSProperties } from 'react';

/**
 * Visual padrão dos cards de Coach na comunidade (lilás sutil + badge verde).
 * Todo perfil com is_coach=true na RPC get_public_community_profiles usa este tema.
 */
export const communityCoachCardTheme = {
  surfaceClass:
    'bg-purple-100/55 border-purple-200/65 hover:shadow-lg hover:border-purple-200/80 transition-all duration-200 dark:bg-purple-500/[0.11] dark:border-purple-400/22',
  elevatedShadowStyle: {
    boxShadow:
      '0 8px 25px rgba(0, 0, 0, 0.15), 0 4px 10px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.05)',
  } satisfies CSSProperties,
  avatarBorderClass: 'border-2 border-purple-200/55 dark:border-purple-500/25',
  avatarShadowStyle: {
    boxShadow:
      '0 8px 20px rgba(0, 0, 0, 0.5), 0 4px 8px rgba(0, 0, 0, 0.4), 0 2px 4px rgba(0, 0, 0, 0.3)',
  } satisfies CSSProperties,
  avatarFallbackClass:
    'bg-gradient-to-br from-purple-400/90 to-purple-500/80 text-white font-semibold',
  footerDividerClass: 'border-purple-200/60 dark:border-purple-500/20',
  studentCountClass: 'text-sm font-semibold tabular-nums text-purple-600/90 dark:text-purple-400/90',
  badgeClass:
    'border-primary/25 bg-primary/5 text-primary dark:border-primary/30 dark:bg-primary/10 dark:text-primary',
} as const;
