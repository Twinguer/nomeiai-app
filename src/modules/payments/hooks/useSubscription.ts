import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { RPCValidator } from '@/utils/rpcValidator';
import {
  isLaunchProPromoActive,
  isLaunchPromoSubscription,
  hasLaunchPromoProAccess,
} from '../domain/launchPromo';
import { ensureLaunchProSubscriptionIfPromoActive } from '../domain/ensureLaunchProSubscription';
import { resolveIsProWithBackend } from '../domain/subscriptionPlan';
import type { Subscription } from '../domain/types';

export type { Subscription, SubscriptionPlan } from '../domain/types';

type SubscriptionQueryResult = {
  subscription: Subscription | null;
  isProFromBackend: boolean;
};

export const useSubscription = () => {
  const { user } = useAuth();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['subscription', user?.id],
    queryFn: async (): Promise<SubscriptionQueryResult> => {
      if (!user?.id) {
        return { subscription: null, isProFromBackend: false };
      }

      await ensureLaunchProSubscriptionIfPromoActive();

      const [subResult, proResult] = await Promise.all([
        supabase.from('user_subscriptions').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.rpc('is_user_pro', { p_user_id: user.id }),
      ]);

      if (subResult.error) {
        throw subResult.error;
      }

      if (proResult.error && import.meta.env.DEV) {
        console.warn('[useSubscription] is_user_pro RPC:', proResult.error.message);
      }

      return {
        subscription: subResult.data as Subscription | null,
        isProFromBackend: proResult.data === true,
      };
    },
    enabled: !!user?.id,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: true,
    retry: 2,
  });

  const subscription = data?.subscription ?? null;
  const isProFromBackend = resolveIsProWithBackend(subscription, data?.isProFromBackend);
  const isPro = isProFromBackend || hasLaunchPromoProAccess(user?.id);
  const isFree = !isPro;
  const isLaunchPromo =
    isPro && isLaunchPromoSubscription(subscription?.voucher_code ?? null);
  const launchPromoActive = isLaunchProPromoActive();
  const maxEditCount = isPro ? Infinity : 3;

  const applyVoucher = async (code: string) => {
    try {
      const validatedCode = RPCValidator.validateVoucherCode(code);
      const { data: result, error } = await supabase.rpc('apply_voucher', {
        voucher_code_param: validatedCode,
      });

      if (error) throw error;

      await refetch();
      return result;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '';
      if (message.includes('Código') || message.includes('inválido')) {
        throw new Error(message);
      }
      throw error;
    }
  };

  const validateDiscountVoucher = async (code: string) => {
    try {
      const validatedCode = RPCValidator.validateVoucherCode(code);
      const { data: result, error } = await supabase.rpc('validate_discount_voucher', {
        voucher_code_param: validatedCode,
      });

      if (error) throw error;
      return result;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '';
      if (message.includes('Código') || message.includes('inválido')) {
        throw new Error(message);
      }
      throw error;
    }
  };

  return {
    subscription,
    isLoading,
    isPro,
    isFree,
    isLaunchPromo,
    launchPromoActive,
    expiresAt: subscription?.expires_at ?? null,
    maxEditCount,
    refetch,
    applyVoucher,
    validateDiscountVoucher,
  };
};
