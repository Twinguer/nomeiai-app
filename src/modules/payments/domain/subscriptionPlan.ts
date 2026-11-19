import type { Subscription } from './types';

/** Resolve se a assinatura ativa equivale a plano Pro (mesma regra do backend). */
export function resolveIsPro(subscription: Subscription | null | undefined): boolean {
  if (!subscription) {
    return false;
  }

  const isPlanPro = subscription.plan === 'pro';
  const isActive = subscription.is_active === true;
  const hasValidExpiry = !subscription.expires_at ||
    new Date(subscription.expires_at).getTime() + 5 * 24 * 60 * 60 * 1000 > Date.now();

  return isPlanPro && isActive && hasValidExpiry;
}

/** Combina leitura da tabela com RPC is_user_pro (fonte de verdade do backend). */
export function resolveIsProWithBackend(
  subscription: Subscription | null | undefined,
  isProFromBackend: boolean | null | undefined,
): boolean {
  if (isProFromBackend === true) {
    return true;
  }
  return resolveIsPro(subscription);
}
