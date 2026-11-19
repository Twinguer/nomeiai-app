import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/modules/payments';
import { useIsActiveCoach } from '@/modules/coach';

/**
 * Acesso a recursos de estudos do plano Pro: assinatura Pro do aluno OU Modo Coach ativo.
 */
export function useStudyProAccess() {
  const { user } = useAuth();
  const { isPro, isLoading: isLoadingPro } = useSubscription();
  const { isActiveCoach, isLoading: isLoadingCoach } = useIsActiveCoach({
    userId: user?.id,
    enabled: !!user?.id,
  });

  const canAccessStudyPro = isPro || isActiveCoach;
  const isLoading = isLoadingPro || isLoadingCoach;

  return {
    isPro,
    isCoachActive: isActiveCoach,
    canAccessStudyPro,
    isLoading,
  };
}
