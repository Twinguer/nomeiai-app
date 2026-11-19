import type { CoachPlanType } from './types';

/** Limites de alunos por plano (espelha CoachSubscriptionPage). */
export const COACH_PLAN_MAX_STUDENTS: Record<CoachPlanType, number> = {
  starter: 5,
  professional: 10,
  enterprise: 25,
};

export function getMaxStudentsForPlan(planType: CoachPlanType): number {
  return COACH_PLAN_MAX_STUDENTS[planType];
}

export function canInviteMoreStudents(currentStudents: number, maxStudents: number): boolean {
  return currentStudents < maxStudents;
}

export function slotsFree(currentStudents: number, maxStudents: number): number {
  return Math.max(0, maxStudents - currentStudents);
}

export function resolveMaxStudents(
  planType: CoachPlanType,
  subscriptionMax?: number | null
): number {
  if (subscriptionMax != null && subscriptionMax > 0) {
    return subscriptionMax;
  }
  return getMaxStudentsForPlan(planType);
}
