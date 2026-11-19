import { supabase } from '@/integrations/supabase/client';
import type { GroupMember } from '../domain/types';
import { logError } from '@/utils/secureLogger';

export const studyGroupMembersService = {
  async getGroupMembers(groupId: string): Promise<GroupMember[]> {
    try {
      const { data, error } = await supabase.rpc('get_group_members', { p_group_id: groupId });
      if (error) throw error;
      return data || [];
    } catch (error) {
      logError('Error fetching group members', error, 'STUDY_GROUPS');
      return [];
    }
  },

  async getUserGroupStatus(groupId: string, userId: string) {
    try {
      const { data, error } = await supabase.rpc('get_user_group_status', {
        p_group_id: groupId,
        p_user_id: userId,
      });

      if (error) throw error;
      return (data && data.length > 0) ? data[0] : {
        is_member: false,
        role: null,
        status: null,
        has_requested: false,
        is_invited: false,
      };
    } catch (error) {
      logError('Error fetching user group status', error, 'STUDY_GROUPS');
      return {
        is_member: false,
        role: null,
        status: null,
        has_requested: false,
        is_invited: false,
      };
    }
  },

  async countGroupMembers(groupId: string): Promise<number> {
    try {
      const { data, error } = await supabase.rpc('count_group_members', { p_group_id: groupId });
      if (error) {
        logError('Error counting group members', error, 'STUDY_GROUPS');
        return 0;
      }
      return data || 0;
    } catch (error) {
      logError('Error counting group members', error, 'STUDY_GROUPS');
      return 0;
    }
  },

  async getUserGroups(userId: string) {
    try {
      const { data, error } = await supabase.rpc('get_user_groups', { p_user_id: userId });
      if (error) throw error;
      return data || [];
    } catch (error) {
      logError('Error fetching user groups', error, 'STUDY_GROUPS');
      return [];
    }
  },

  /** Grupos públicos do usuário — visíveis no perfil público (qualquer visitante). */
  async getUserPublicGroups(userId: string) {
    try {
      const { data, error } = await supabase.rpc('get_user_public_groups', { p_user_id: userId });
      if (error) throw error;
      return data || [];
    } catch (error) {
      logError('Error fetching user public groups', error, 'STUDY_GROUPS');
      return [];
    }
  },

  async requestToJoinGroup(groupId: string, userId: string): Promise<{ success: boolean; message?: string; error?: string; requires_upgrade?: boolean; requires_invite?: boolean }> {
    try {
      const { data, error } = await supabase.rpc('request_to_join_group', {
        p_group_id: groupId,
        p_user_id: userId,
      });

      if (error) throw error;
      return data as { success: boolean; message?: string; error?: string; requires_upgrade?: boolean; requires_invite?: boolean };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao solicitar entrada';
      logError('Error requesting to join group', error, 'STUDY_GROUPS');
      return { success: false, error: message };
    }
  },

  async inviteUserToGroup(groupId: string, userId: string, inviterId: string): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const { data, error } = await supabase.rpc('invite_user_to_group', {
        p_group_id: groupId,
        p_user_id: userId,
        p_inviter_id: inviterId,
      });

      if (error) throw error;
      return data as { success: boolean; message?: string; error?: string };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao convidar usuário';
      logError('Error inviting user to group', error, 'STUDY_GROUPS');
      return { success: false, error: message };
    }
  },

  async respondToJoinRequest(
    memberId: string,
    groupId: string,
    adminId: string,
    accept: boolean
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const { data, error } = await supabase.rpc('respond_to_join_request', {
        p_member_id: memberId,
        p_group_id: groupId,
        p_admin_id: adminId,
        p_accept: accept,
      });

      if (error) throw error;
      return data as { success: boolean; message?: string; error?: string };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao processar pedido';
      logError('Error responding to join request', error, 'STUDY_GROUPS');
      return { success: false, error: message };
    }
  },

  async getPendingRequests(groupId: string) {
    try {
      const { data, error } = await supabase.rpc('get_group_pending_requests', {
        p_group_id: groupId,
      });

      if (error) throw error;
      return data || [];
    } catch (error) {
      logError('Error fetching pending requests', error, 'STUDY_GROUPS');
      return [];
    }
  },

  async leaveGroup(groupId: string, userId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase.rpc('leave_study_group', {
        p_group_id: groupId,
        p_user_id: userId,
      });

      if (error) throw error;

      if (data && typeof data === 'object' && 'success' in data) {
        if (!(data as { success: boolean }).success) {
          throw new Error((data as { message?: string }).message || 'Erro ao sair do grupo');
        }
        return true;
      }

      return true;
    } catch (error) {
      logError('Error leaving group', error, 'STUDY_GROUPS');
      throw error;
    }
  },
};
