import { supabase } from '@/integrations/supabase/client';
import type { StudyGroup, CreateGroupInput, UpdateGroupInput } from '../domain/types';
import { logError } from '@/utils/secureLogger';

export const studyGroupService = {
  async getGroup(groupId: string): Promise<StudyGroup | null> {
    const { data, error } = await supabase
      .from('study_groups')
      .select('*')
      .eq('id', groupId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  async createGroup(input: CreateGroupInput): Promise<StudyGroup> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuário não autenticado');

    const { data, error } = await supabase
      .from('study_groups')
      .insert({
        ...input,
        created_by: user.id,
        privacy_level: input.privacy_level || 'public',
        max_members: input.max_members || 50,
        post_retention_days: input.post_retention_days || 365,
        posts_data: [],
        group_settings: {},
      })
      .select()
      .single();

    if (error) throw error;

    const { error: memberError } = await supabase
      .from('study_group_members')
      .insert({
        group_id: data.id,
        user_id: user.id,
        role: 'admin',
        status: 'active',
      });

    if (memberError) {
      logError('Erro ao adicionar criador como membro', memberError, 'STUDY_GROUPS');
    }

    return data;
  },

  async updateGroup(groupId: string, input: UpdateGroupInput): Promise<StudyGroup> {
    const { data, error } = await supabase
      .from('study_groups')
      .update({
        ...input,
        updated_at: new Date().toISOString(),
      })
      .eq('id', groupId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async getPublicGroups(limit: number = 20): Promise<StudyGroup[]> {
    const { data, error } = await supabase
      .from('study_groups')
      .select('*')
      .eq('privacy_level', 'public')
      .eq('archived', false)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  },
};
