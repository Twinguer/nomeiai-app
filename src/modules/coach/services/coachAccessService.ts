import { supabase } from '@/integrations/supabase/client';
import { devLog } from '@/utils/productionLogger';
import {
  normalizeCoachAccessResult,
  parseCoachRpcJson,
} from './coachRpcHelpers';

export type CoachStudentAccessResult = {
  allowed: boolean;
  reason?: string;
  message?: string;
};

export type CoachStudentDisplayResult = {
  success: boolean;
  display_name?: string;
  avatar_url?: string | null;
  error?: string;
  message?: string;
};

export const coachAccessService = {
  async checkHasStudentAccess(
    coachId: string,
    studentId: string
  ): Promise<CoachStudentAccessResult> {
    const { data, error } = await supabase.rpc('check_coach_has_student_access', {
      p_coach_id: coachId,
      p_student_id: studentId,
    });

    if (error) {
      devLog.error('[coachAccessService] check_coach_has_student_access:', error);
      throw error;
    }

    const result = normalizeCoachAccessResult(data);
    if (import.meta.env.DEV) {
      devLog.log('[coachAccessService] access result:', {
        allowed: result.allowed,
        reason: result.reason,
      });
    }
    return result;
  },

  async getStudentDisplay(studentId: string): Promise<CoachStudentDisplayResult> {
    const { data, error } = await supabase.rpc('get_coach_student_display', {
      p_student_id: studentId,
    });

    if (error) {
      devLog.error('[coachAccessService] get_coach_student_display:', error);
      throw error;
    }

    const parsed = parseCoachRpcJson<CoachStudentDisplayResult>(data);
    return parsed ?? { success: false, error: 'empty_response' };
  },

  async generateStudyCycleToken(
    coachId: string,
    studentId: string,
    cycleId: string
  ): Promise<string> {
    const { data, error } = await supabase.rpc('generate_coach_study_cycle_token', {
      p_student_id: studentId,
      p_cycle_id: cycleId,
    });

    if (error) {
      devLog.error('[coachAccessService] generate_coach_study_cycle_token:', error);
      throw error;
    }

    if (!data || typeof data !== 'string') {
      throw new Error('Token de ciclo não foi gerado');
    }

    if (import.meta.env.DEV) {
      devLog.log('[coachAccessService] cycle token gerado para coach:', {
        coachId,
        studentId,
        cycleIdPrefix: cycleId.slice(0, 8),
      });
    }

    return data;
  },
};
