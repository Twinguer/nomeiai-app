import { toast } from 'sonner';
import { NavigateFunction } from 'react-router-dom';

/**
 * Regras de negócio para planos Free e Pro
 */
export const PLAN_LIMITS = {
  FREE: {
    MAX_RANKINGS_CREATED: Infinity, // Sem limite para criar
    MAX_RANKINGS_PARTICIPATION: 2,  // Pode participar de até 2 que não criou
    MAX_EDITS_PER_ANSWER_SHEET: 3,
    CAN_CREATE_STUDY_GROUPS: false,
    CAN_BE_STUDENT_IN_COACH_MODE: false,
  },
  PRO: {
    MAX_RANKINGS_CREATED: Infinity,
    MAX_RANKINGS_PARTICIPATION: Infinity,
    MAX_EDITS_PER_ANSWER_SHEET: Infinity,
    CAN_CREATE_STUDY_GROUPS: true,
    CAN_BE_STUDENT_IN_COACH_MODE: true,
  }
} as const;

/**
 * Função utilitária padronizada para mostrar toast de restrição de plano Pro
 * e redirecionar para a página de planos
 */
export const showProRequiredToast = (navigate: NavigateFunction, featureName?: string) => {
  const message = featureName
    ? `O recurso "${featureName}" exige plano Pro ou assinatura Modo Coach ativa.`
    : 'Este recurso exige plano Pro ou assinatura Modo Coach ativa.';
  
  toast.error(message, {
    duration: 6000
  });
  
  navigate('/planos');
};

/**
 * Mostra toast específico para limite de participação em rankings
 */
export const showRankingParticipationLimitToast = (navigate: NavigateFunction) => {
  toast.error(
    'Usuários Free podem participar de até 2 rankings que não criaram. Assine o plano Pro para participar de mais rankings.',
    { duration: 7000 }
  );
  navigate('/planos');
};

/**
 * Mostra toast específico para limite de edições
 */
export const showEditLimitReachedToast = (navigate: NavigateFunction) => {
  toast.error(
    'Você atingiu o limite de 3 edições para usuários Free. Assine o plano Pro para edições ilimitadas.',
    { duration: 7000 }
  );
  navigate('/planos');
};

