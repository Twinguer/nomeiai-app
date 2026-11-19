export type SubscriptionPlan = 'free' | 'pro';

export interface Subscription {
  id: string;
  user_id: string;
  plan: SubscriptionPlan;
  is_active: boolean;
  expires_at: string | null;
  voucher_code: string | null;
}

export interface CreateCheckoutResponse {
  url: string;
  session_id: string;
}

export interface PaymentOrderStatus {
  id: string;
  plan_id: string;
  status: string;
  amount: number;
  period_ends_at: string | null;
}

export interface CreatePreferenceParams {
  planId: string;
  email?: string;
  name?: string;
  voucherCode?: string;
}

export interface VerifySubscriptionResult {
  success: boolean;
  message: string;
  plan_id?: string;
}

export type DiscountType = 'percentage' | 'fixed';

export interface AppliedDiscountVoucher {
  code: string;
  discountType: DiscountType;
  discountValue: number;
}

export interface ProPlanDefinition {
  id: string;
  nome: string;
  preco: number;
  descricao: string;
  periodo: string;
  popular: boolean;
  features: string[];
}

export interface PlanLimitsResponse {
  is_pro: boolean;
  is_coach: boolean;
  can_create_ranking: boolean;
  can_participate_in_ranking: boolean;
  can_create_cycle: boolean;
  can_create_study_group: boolean;
  can_be_coach_student: boolean;
  can_access_study_groups: boolean;
  limits: {
    max_rankings_created: number | null;
    max_rankings_participation: number | null;
    max_edits_per_answer_sheet: number | null;
    can_create_study_groups: boolean;
    can_be_student_in_coach_mode: boolean;
  };
  current_usage: {
    created_rankings_count: number;
    participation_data: {
      total: number;
      created: number;
      others: number;
    };
    cycle_count: number;
  };
}
