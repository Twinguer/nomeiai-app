import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { devLog } from '@/utils/productionLogger';
import { coachSubscriptionService, isActiveCoachSubscription } from '@/modules/coach';
import { hasLaunchPromoProAccess } from '../domain/launchPromo';
import { ensureLaunchProSubscriptionIfPromoActive } from '../domain/ensureLaunchProSubscription';
import { DEFAULT_PLAN_LIMITS } from '../domain/planCatalog';
import type { PlanLimitsResponse } from '../domain/types';

/**
 * Hook que busca limites de plano do backend.
 * Todas as validações são feitas no backend via RPC.
 */
export const usePlanLimits = () => {
  const { user } = useAuth();

  const { data, isLoading, error } = useQuery({
    queryKey: ['user-plan-limits', user?.id],
    queryFn: async () => {
      if (!user?.id) {
        return null;
      }

      await ensureLaunchProSubscriptionIfPromoActive();

      const { data: result, error: rpcError } = await supabase.rpc('get_user_plan_limits', {
        p_user_id: user.id,
      });

      let planLimits = result as PlanLimitsResponse | null;

      if (rpcError) {
        devLog.error('[usePlanLimits] Erro ao buscar limites:', rpcError);
        planLimits = null;
      }

      if (!planLimits?.is_coach) {
        try {
          const coachSub = await coachSubscriptionService.getCoachSubscription(user.id);
          const coachActive = isActiveCoachSubscription(coachSub);
          if (coachActive && planLimits) {
            planLimits = {
              ...planLimits,
              is_coach: true,
              can_create_cycle: true,
              can_access_study_groups: true,
              can_create_study_group: planLimits.can_create_study_group || true,
            };
          } else if (coachActive && !planLimits) {
            planLimits = {
              ...DEFAULT_PLAN_LIMITS,
              is_coach: true,
              can_create_cycle: true,
              can_access_study_groups: true,
              can_create_study_group: true,
            };
          }
        } catch {
          // RLS ou ausência de assinatura — manter limites da RPC
        }
      }

      if (!planLimits && rpcError) {
        const { data: isProRpc } = await supabase.rpc('is_user_pro', { p_user_id: user.id });
        if (isProRpc === true) {
          return {
            ...DEFAULT_PLAN_LIMITS,
            is_pro: true,
            can_participate_in_ranking: true,
            can_create_cycle: true,
            can_access_study_groups: true,
            can_create_study_group: true,
            limits: {
              ...DEFAULT_PLAN_LIMITS.limits,
              max_rankings_participation: null,
              max_edits_per_answer_sheet: null,
            },
          };
        }
        if (hasLaunchPromoProAccess(user.id)) {
          return {
            ...DEFAULT_PLAN_LIMITS,
            is_pro: true,
            can_participate_in_ranking: true,
            can_create_cycle: true,
            can_access_study_groups: true,
            can_create_study_group: true,
            limits: {
              ...DEFAULT_PLAN_LIMITS.limits,
              max_rankings_participation: null,
              max_edits_per_answer_sheet: null,
            },
          };
        }
        throw rpcError;
      }

      if (planLimits && hasLaunchPromoProAccess(user.id) && !planLimits.is_pro && !planLimits.is_coach) {
        planLimits = {
          ...planLimits,
          is_pro: true,
          can_participate_in_ranking: true,
          can_create_cycle: true,
          can_access_study_groups: true,
          can_create_study_group: true,
          limits: {
            ...planLimits.limits,
            max_rankings_participation: null,
            max_edits_per_answer_sheet: null,
          },
        };
      }

      return planLimits;
    },
    enabled: !!user?.id,
    staleTime: 30000,
    retry: 1,
  });

  const planData = data || DEFAULT_PLAN_LIMITS;

  const launchPromoPro = hasLaunchPromoProAccess(user?.id);

  return {
    canCreateRanking: planData.can_create_ranking,
    canParticipateInRanking: planData.can_participate_in_ranking || launchPromoPro,
    currentCreatedRankingsCount: planData.current_usage.created_rankings_count,
    currentParticipatingCount: planData.current_usage.participation_data.total,
    participatingInOthersCount: planData.current_usage.participation_data.others,
    maxParticipationInOthers: planData.limits.max_rankings_participation || 2,
    canCreateCycle: planData.can_create_cycle || planData.is_coach || launchPromoPro,
    currentCycleCount: planData.current_usage.cycle_count,
    canCreateStudyGroup: planData.can_create_study_group || launchPromoPro,
    canAccessStudyGroups:
      planData.can_access_study_groups || planData.is_pro || planData.is_coach || launchPromoPro,
    canBeCoachStudent: planData.can_be_coach_student,
    isCoach: planData.is_coach,
    maxEditsPerAnswerSheet: planData.limits.max_edits_per_answer_sheet || 3,
    isPro: planData.is_pro || launchPromoPro,
    isLoading,
    error,
  };
};
