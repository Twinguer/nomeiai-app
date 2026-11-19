import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { coachSubscriptionService } from '../services/coachSubscriptionService';
import { isCoachSubscriptionActive } from '../domain/invitationRules';
import type { CoachSubscription } from '../domain/types';

export function isActiveCoachSubscription(
  subscription: CoachSubscription | null | undefined
): boolean {
  if (!subscription) return false;
  return isCoachSubscriptionActive(subscription.status, subscription.expires_at);
}

type UseIsActiveCoachOptions = {
  userId?: string;
  enabled?: boolean;
};

/** Indica se o usuário tem assinatura coach ativa (API pública cross-module). */
export function useIsActiveCoach(options: UseIsActiveCoachOptions = {}) {
  const { user } = useAuth();
  const userId = options.userId ?? user?.id;
  const enabled = options.enabled !== false && !!userId;

  const query = useQuery({
    queryKey: ['coach-subscription', userId],
    queryFn: () => coachSubscriptionService.getCoachSubscription(userId!),
    enabled,
  });

  const subscription = query.data;
  const isActive = isActiveCoachSubscription(subscription);

  return {
    subscription,
    isActiveCoach: isActive,
    isLoading: query.isLoading,
    isFetched: query.isFetched,
    refetch: query.refetch,
  };
}
