import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { coachSubscriptionService } from '../services/coachSubscriptionService';
import type { CanInviteResponse, CoachSubscription } from '../domain/types';

type UseCoachSubscriptionOptions = {
  enabled?: boolean;
  /** Quando false, não busca canInvite (ex.: landing). */
  fetchCanInvite?: boolean;
};

export function useCoachSubscription(options: UseCoachSubscriptionOptions = {}) {
  const { user } = useAuth();
  const enabled = options.enabled !== false && !!user;
  const fetchCanInvite = options.fetchCanInvite !== false;

  const subscriptionQuery = useQuery({
    queryKey: ['coach-subscription', user?.id],
    queryFn: () => coachSubscriptionService.getCoachSubscription(user!.id),
    enabled,
  });

  const canInviteQuery = useQuery({
    queryKey: ['coach-can-invite', user?.id],
    queryFn: () => coachSubscriptionService.checkIfCanInvite(user!.id),
    enabled: enabled && fetchCanInvite && !!subscriptionQuery.data,
  });

  return {
    user,
    subscription: subscriptionQuery.data as CoachSubscription | null | undefined,
    isLoadingSubscription: subscriptionQuery.isLoading,
    isSubscriptionFetched: subscriptionQuery.isFetched,
    canInvite: canInviteQuery.data as CanInviteResponse | undefined,
    isLoadingCanInvite: canInviteQuery.isLoading,
    refetchSubscription: subscriptionQuery.refetch,
  };
}
