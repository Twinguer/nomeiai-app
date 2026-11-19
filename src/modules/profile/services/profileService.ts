import { supabase } from '@/integrations/supabase/client';
import { validateFileUploadSimple } from '@/utils/fileUploadValidator';
import type { ProfilePrivacySettings } from '@/utils/profilePrivacySettings';
import { devLog } from '@/utils/productionLogger';
import {
  mapPublicProfileRpcResponse,
  type PublicProfileData,
} from '../domain/publicProfileMapper';

export type { PublicProfileData };

export type UserProfileRecord = {
  id: string;
  email: string;
  name: string;
  nickname: string | null;
  avatar_url: string | null;
  bio: string | null;
  profile_text: string | null;
  status_concurseiro: string | null;
  concursos_aprovados: string | null;
  concursos_participando: string | null;
  estado: string | null;
  formacao: string | null;
  cargo_atual: string | null;
  area_estudos: string | null;
  especialidade: string | null;
  curso_preparatorio: string | null;
  rotina_estudos: string | null;
  privacy_settings: unknown;
  created_at: string;
  updated_at: string;
};

export type ProfileFormPayload = {
  name: string;
  profile_text: string;
  concursos_aprovados: string;
  concursos_participando: string;
  avatar_url: string | null;
  status_concurseiro: string;
  estado: string;
  formacao: string;
  cargo_atual: string;
  area_estudos: string;
  especialidade: string;
  curso_preparatorio: string;
  rotina_estudos: string;
  privacy_settings: ProfilePrivacySettings;
};

export const profileService = {
  async fetchPublicProfile(userId: string): Promise<PublicProfileData | null> {
    const { data, error } = await supabase.rpc('get_public_user_profile_secure', {
      p_user_id: userId,
    });

    if (error) throw error;

    const payload = data as { success?: boolean; error?: string; data?: unknown };
    if (!payload?.success || !payload.data || typeof payload.data !== 'object') {
      return null;
    }

    return mapPublicProfileRpcResponse(payload.data as Parameters<typeof mapPublicProfileRpcResponse>[0]);
  },

  async fetchByUserId(userId: string): Promise<UserProfileRecord | null> {
    const { data, error } = await supabase
      .from('users_profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error?.code === 'PGRST116') {
      return null;
    }

    if (error) throw error;
    return data as UserProfileRecord;
  },

  async createForAuthUser(user: {
    id: string;
    email?: string;
    user_metadata?: { name?: string };
  }): Promise<UserProfileRecord> {
    const { data, error } = await supabase
      .from('users_profiles')
      .insert({
        id: user.id,
        email: user.email,
        name: user.user_metadata?.name || user.email?.split('@')[0] || 'User',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status_concurseiro: 'Na Ativa',
        profile_text: '',
      })
      .select('*')
      .single();

    if (error) throw error;
    return data as UserProfileRecord;
  },

  async fetchOrCreate(user: {
    id: string;
    email?: string;
    user_metadata?: { name?: string };
  }): Promise<UserProfileRecord> {
    const existing = await this.fetchByUserId(user.id);
    if (existing) return existing;
    return this.createForAuthUser(user);
  },

  async updateProfile(userId: string, payload: ProfileFormPayload): Promise<UserProfileRecord> {
    const { data, error } = await supabase
      .from('users_profiles')
      .update({
        ...payload,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select('*')
      .single();

    if (error) throw error;
    return data as UserProfileRecord;
  },

  async updatePrivacySettings(
    userId: string,
    privacySettings: ProfilePrivacySettings
  ): Promise<void> {
    const { error } = await supabase
      .from('users_profiles')
      .update({
        privacy_settings: privacySettings,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (error) throw error;
  },

  async updateAvatarUrl(userId: string, avatarUrl: string): Promise<void> {
    const { error } = await supabase
      .from('users_profiles')
      .update({
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (error) throw error;
  },

  async uploadAvatar(userId: string, file: File): Promise<string> {
    const validation = validateFileUploadSimple(file, 'AVATAR', true);
    if (!validation.isValid) {
      throw new Error(validation.errors.join('. '));
    }

    const fileExt = file.name.split('.').pop();
    const filePath = `${userId}-${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage.from('profiles').upload(filePath, file, {
      cacheControl: '3600',
      upsert: true,
      contentType: file.type,
    });

    if (uploadError) throw uploadError;

    const {
      data: { publicUrl },
    } = supabase.storage.from('profiles').getPublicUrl(filePath);

    await this.updateAvatarUrl(userId, publicUrl);
    return publicUrl;
  },

  async validateNicknameAvailability(nickname: string, userId: string) {
    const { data, error } = await supabase.rpc('validate_nickname_availability', {
      p_nickname: nickname,
      p_user_id: userId,
    });

    if (error) throw error;
    return data as { is_valid?: boolean; reason?: string };
  },

  async updateNickname(userId: string, nickname: string | null) {
    const { data, error } = await supabase.rpc('update_user_nickname', {
      p_user_id: userId,
      p_nickname: nickname,
    });

    if (error) throw error;
    return data as { success?: boolean; error?: string; nickname?: string | null };
  },

  async isUserCoach(userId: string): Promise<boolean> {
    try {
      const { data: coachCheck, error: coachError } = await supabase.rpc('is_user_coach', {
        p_user_id: userId,
      });

      if (!coachError && coachCheck === true) return true;

      const { data: coachSubscription, error: subError } = await supabase
        .from('coach_subscriptions')
        .select('id, status, expires_at')
        .eq('coach_id', userId)
        .eq('status', 'active')
        .maybeSingle();

      if (subError && subError.code !== 'PGRST116' && subError.code !== 'PGRST406') {
        devLog.error('Coach subscription check failed', subError);
        return false;
      }

      return (
        !!coachSubscription &&
        (!coachSubscription.expires_at || new Date(coachSubscription.expires_at) > new Date())
      );
    } catch (error) {
      devLog.error('isUserCoach failed', error);
      return false;
    }
  },
};
