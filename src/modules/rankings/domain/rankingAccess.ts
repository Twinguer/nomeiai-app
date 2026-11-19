/**
 * Regras de acesso à classificação (visibilidade da tabela).
 * Fonte única — usada na navegação (listagem) e em ResultadosPage.
 */

export type ClassificationAccessParams = {
  user: { id: string } | null;
  isPro: boolean;
  isShowcase: boolean;
  isParticipating: boolean;
  createdByUserId?: string | null;
};

/** Pode exibir a tabela de classificação em ResultadosPage. */
export function canViewClassification(params: ClassificationAccessParams): boolean {
  const { user, isPro, isShowcase, isParticipating, createdByUserId } = params;

  if (!user) {
    return true;
  }
  if (isShowcase) {
    return true;
  }
  if (isPro) {
    return true;
  }
  if (createdByUserId && createdByUserId === user.id) {
    return true;
  }
  if (isParticipating) {
    return true;
  }
  return false;
}

export type ConsolidatedRankingsData = {
  rankings?: Record<string, { concurso_id?: string }>;
};

export function isParticipatingInConcurso(
  consolidatedData: ConsolidatedRankingsData | null | undefined,
  concursoId: string,
): boolean {
  if (!consolidatedData?.rankings) {
    return false;
  }

  return Object.values(consolidatedData.rankings).some(
    (rankingData) => rankingData.concurso_id === concursoId,
  );
}

/** Listagem: abrir classificação direto (sem checar limite Free). */
export function canOpenClassificationFromList(params: {
  user: { id: string } | null;
  isPro: boolean;
  isShowcase: boolean;
  isCreator: boolean;
  isParticipating: boolean;
}): boolean {
  if (params.isShowcase) {
    return true;
  }
  if (!params.user) {
    return false;
  }
  if (params.isPro) {
    return true;
  }
  if (params.isCreator) {
    return true;
  }
  if (params.isParticipating) {
    return true;
  }
  return false;
}
