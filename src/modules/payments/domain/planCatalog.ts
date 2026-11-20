import type { AppliedDiscountVoucher, ProPlanDefinition } from './types';

/** Hierarquia: free (0) < pro (1) < coach_starter (2) < coach_professional (3) < coach_enterprise (4) */
export const PLAN_LEVELS: Record<string, number> = {
  free: 0,
  pro: 1,
  coach_starter: 2,
  coach_professional: 3,
  coach_enterprise: 4,
};

export const PRO_PLAN_CATALOG: ProPlanDefinition[] = [
  {
    id: 'free',
    nome: 'Gratuito',
    preco: 0,
    descricao: 'Para comparar o desempenho',
    periodo: 'Livre',
    popular: false,
    features: [
      'Pode criar Rankings;',
      'Participa de todo o ranking que criar;',
      'Participa de até 2 rankings que não criou;',
      'Visualisa os rankings que participa;',
      'Máximo de 3 edições por cartão de respostas;',
      'Não pode criar Grupos de estudos;',
      'Não pode ser aluno no Modo Coach;',
      'Com propagandas;',
    ],
  },
  {
    id: 'pro',
    nome: 'Aluno Pro',
    preco: 9.9,
    descricao: 'Acesso Amplo',
    periodo: 'Mês',
    popular: true,
    features: [
      'Pagamento mensal por Pix ou cartão, com renovação manual;',
      '5 dias de tolerância após o vencimento;',
      'Participa de até 5 Rankings simultâneos;',
      'Visualização de todos os Rankings;',
      'Criação de Rankings;',
      'Criação de Grupos de Estudos;',
      'Estatísticas completas;',
      'Ciclos de estudos;',
      'Editais verticalizados;',
      'Acesso aos perfis da comunidade;',
      'Edições ilimitadas nos cartões de respostas;',
      'Pode ser aluno no Modo Coach;',
      'Sem propaganda;',
    ],
  },
];

export function getPlanLevel(planId: string): number {
  return PLAN_LEVELS[planId] ?? 0;
}

export function calculateDiscountedPrice(
  originalPrice: number,
  voucher: AppliedDiscountVoucher | null,
): number {
  if (!voucher) {
    return originalPrice;
  }
  const discountAmount =
    voucher.discountType === 'percentage'
      ? (originalPrice * voucher.discountValue) / 100
      : voucher.discountValue;
  return Math.max(0.01, originalPrice - discountAmount);
}

export function formatPlanPrice(price: number): string {
  return price.toFixed(2).replace('.', ',');
}

export function formatDiscountLabel(voucher: AppliedDiscountVoucher): string {
  return voucher.discountType === 'percentage'
    ? `${voucher.discountValue}% OFF`
    : `R$ ${voucher.discountValue.toFixed(2)} OFF`;
}

export const DEFAULT_PLAN_LIMITS = {
  is_pro: false,
  is_coach: false,
  can_create_ranking: true,
  can_participate_in_ranking: false,
  can_create_cycle: false,
  can_create_study_group: false,
  can_be_coach_student: false,
  can_access_study_groups: false,
  limits: {
    max_rankings_created: null,
    max_rankings_participation: 2,
    max_edits_per_answer_sheet: 3,
    can_create_study_groups: false,
    can_be_student_in_coach_mode: false,
  },
  current_usage: {
    created_rankings_count: 0,
    participation_data: { total: 0, created: 0, others: 0 },
    cycle_count: 0,
  },
} as const;
