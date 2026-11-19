import { supabase } from '@/integrations/supabase/client';
import type { CanInviteResponse, CoachSubscription } from '../domain/types';

export const coachSubscriptionService = {
  async getCoachSubscription(coachId: string): Promise<CoachSubscription | null> {
    const { data, error } = await supabase
      .from('coach_subscriptions')
      .select('*')
      .eq('coach_id', coachId)
      .eq('status', 'active')
      .maybeSingle();

    if (error && error.code !== 'PGRST116' && error.code !== 'PGRST406') {
      throw error;
    }
    return data;
  },

  async checkIfCanInvite(coachId: string): Promise<CanInviteResponse> {
    const { data, error } = await supabase.rpc('check_if_can_invite_student', {
      p_coach_id: coachId,
    });

    if (error) throw error;
    return data as CanInviteResponse;
  },
};
