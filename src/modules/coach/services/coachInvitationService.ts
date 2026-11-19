import { supabase } from '@/integrations/supabase/client';
import { logError, logWarn } from '@/utils/secureLogger';
import { normalizeNicknameInput } from '@/utils/nicknameUtils';

export type CoachPendingInvitation = {
  id: string;
  coach_id: string;
  student_id?: string | null;
  student_email?: string | null;
  status: string;
  invited_at: string;
  expires_at?: string | null;
  invitation_message?: string | null;
  student_name?: string;
  student_nickname?: string | null;
  student_avatar?: string | null;
};

export type CoachInviteSearchUser = {
  id: string;
  name: string | null;
  nickname: string | null;
  avatar_url: string | null;
};

export type SendCoachInvitationResult = {
  success: boolean;
  error?: string;
  message?: string;
};

async function enrichPendingInvitations(
  rows: CoachPendingInvitation[]
): Promise<CoachPendingInvitation[]> {
  return Promise.all(
    rows.map(async (invitation) => {
      if (invitation.student_id) {
        const { data: studentData } = await supabase
          .from('users_profiles')
          .select('name, nickname, avatar_url')
          .eq('id', invitation.student_id)
          .single();

        return {
          ...invitation,
          student_name: studentData?.name || invitation.student_email || 'Aluno',
          student_nickname: studentData?.nickname ?? null,
          student_avatar: studentData?.avatar_url ?? null,
        };
      }

      return {
        ...invitation,
        student_name: invitation.student_email || 'Aluno desconhecido',
        student_nickname: null,
        student_avatar: null,
      };
    })
  );
}

export const coachInvitationService = {
  async fetchPendingInvitations(coachId: string): Promise<CoachPendingInvitation[]> {
    const runQuery = () =>
      supabase
        .from('coach_invitations_history')
        .select('*')
        .eq('coach_id', coachId)
        .eq('status', 'pending')
        .order('invited_at', { ascending: false });

    const { data, error } = await runQuery();

    if (error) {
      logError('Erro ao buscar convites pendentes', error, 'COACH');
      if (error.code === 'PGRST301' || error.message?.includes('403')) {
        logWarn('Erro 403 detectado, aguardando atualização do cache', { coachId }, 'COACH');
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const { data: retryData, error: retryError } = await runQuery();
        if (retryError) throw retryError;
        return enrichPendingInvitations((retryData || []) as CoachPendingInvitation[]);
      }
      throw error;
    }

    return enrichPendingInvitations((data || []) as CoachPendingInvitation[]);
  },

  async cancelInvitation(
    coachId: string,
    invitationId: string
  ): Promise<{ success?: boolean; message?: string; error?: string }> {
    const { data, error } = await supabase.rpc('cancel_coach_invitation', {
      p_invitation_id: invitationId,
      p_coach_id: coachId,
    });

    if (error) throw error;

    const result = data as { success?: boolean; message?: string; error?: string } | null;
    if (result && result.success === false) {
      throw new Error(result.error || 'Erro ao cancelar convite');
    }

    return result ?? { success: true };
  },

  async sendInvitation(
    coachId: string,
    studentNickname: string,
    invitationMessage: string | null
  ): Promise<SendCoachInvitationResult> {
    const { data, error } = await supabase.rpc('send_coach_invitation', {
      p_coach_id: coachId,
      p_student_nickname: studentNickname,
      p_invitation_message: invitationMessage,
    });

    if (error) throw error;
    return (data ?? { success: false, error: 'Resposta vazia' }) as SendCoachInvitationResult;
  },

  async searchUsersForInvite(query: string): Promise<CoachInviteSearchUser[]> {
    const cleanQuery = query.toLowerCase().replace(/^@/, '').trim();
    if (!cleanQuery) return [];

    const { data, error } = await supabase
      .from('users_profiles')
      .select('id, name, nickname, avatar_url')
      .or(`nickname.ilike.%${cleanQuery}%,name.ilike.%${cleanQuery}%`)
      .limit(10);

    if (error) throw error;

    return (data || []).map((profile) => {
      if (!profile.nickname || profile.nickname.trim() === '') {
        const generatedNickname =
          normalizeNicknameInput(profile.name || 'user') ||
          `user${profile.id.substring(0, 8)}`;

        return { ...profile, nickname: generatedNickname };
      }
      return profile;
    });
  },

  async fetchInvitationById(invitationId: string) {
    const { data, error } = await supabase
      .from('coach_invitations_history')
      .select(`
        *,
        coach:users_profiles!coach_invitations_history_coach_id_fkey(id, name, email)
      `)
      .eq('id', invitationId)
      .single();

    if (error) throw error;
    return data;
  },

  async acceptInvitation(
    invitationId: string,
    consentData: { study_data: boolean; statistics: boolean; profile_basic?: boolean }
  ) {
    const { data, error } = await supabase.rpc('accept_coach_invitation', {
      p_invitation_id: invitationId,
      p_consent_data: consentData,
    });

    if (error) throw error;

    const result = data as { success?: boolean; error?: string } | null;
    if (!result?.success) {
      throw new Error(result?.error || 'Erro ao aceitar convite');
    }

    return result;
  },

  async rejectInvitation(invitationId: string) {
    const { error: deleteError } = await supabase
      .from('coach_invitations_history')
      .delete()
      .eq('id', invitationId);

    if (deleteError) throw deleteError;

    await supabase
      .from('notifications')
      .delete()
      .eq('type', 'coach_invitation')
      .eq('metadata->>invitation_id', invitationId);
  },
};
