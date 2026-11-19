import { useEffect, useState } from 'react';
import { canViewClassification } from '@/modules/rankings/domain/rankingAccess';

type ConcursoAccessInfo = {
  is_showcase?: boolean;
  created_by_user_id?: string | null;
};

export function useClassificationAccess(params: {
  concurso: ConcursoAccessInfo | null | undefined;
  user: { id: string } | null | undefined;
  isPro: boolean;
  isParticipating: boolean;
  /** Aguardar resolução do plano antes de negar acesso (evita falso Free). */
  isProLoading?: boolean;
}) {
  const { concurso, user, isPro, isParticipating, isProLoading = false } = params;
  const [canViewRanking, setCanViewRanking] = useState<boolean | null>(null);
  const [isCheckingAccess, setIsCheckingAccess] = useState(true);

  useEffect(() => {
    if (!concurso) {
      setCanViewRanking(true);
      setIsCheckingAccess(false);
      return;
    }

    if (user && isProLoading) {
      setIsCheckingAccess(true);
      return;
    }

    setCanViewRanking(
      canViewClassification({
        user: user ?? null,
        isPro,
        isShowcase: concurso.is_showcase === true,
        isParticipating,
        createdByUserId: concurso.created_by_user_id,
      }),
    );
    setIsCheckingAccess(false);
  }, [concurso, user, isPro, isParticipating, isProLoading]);

  return { canViewRanking, isCheckingAccess };
}
