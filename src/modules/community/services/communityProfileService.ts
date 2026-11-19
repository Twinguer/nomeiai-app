import { supabase } from '@/integrations/supabase/client';
import { devLog } from '@/utils/productionLogger';
import { mapCommunityProfileFlags } from '../domain/communityProfileRules';
import { formatPublicNicknameHandle, stripNicknamePrefix } from '@/utils/nicknameUtils';
import type { CommunityUserProfile } from '../domain/types';

export const communityProfileService = {
  async fetchPublicProfiles(search: string | null, limit = 120, offset = 0): Promise<CommunityUserProfile[]> {
    const { data: profiles, error } = await supabase.rpc('get_public_community_profiles', {
      p_search: search,
      p_limit: limit,
      p_offset: offset,
    });

    if (error) {
      devLog.error('Error fetching community profiles via RPC:', error);
      throw error;
    }

    return (profiles || []).map((profile) => {
      const { isCoach, hasActiveCoach, activeStudentCount, isPro } = mapCommunityProfileFlags(profile ?? {});

      const displayName = profile?.name ?? 'Concurseiro';
      const usernameFromName = displayName
        ? displayName.toLowerCase().replace(/[^a-z0-9]/g, '')
        : `user_${String(profile?.id).slice(0, 8)}`;
      const fallbackEmail = `${usernameFromName || 'usuario'}@privado.convoca`;

      return {
        id: profile?.id,
        name: displayName,
        nickname: stripNicknamePrefix(profile?.nickname) || null,
        publicHandle: formatPublicNicknameHandle(profile?.nickname),
        avatar_url: profile?.avatar_url || '',
        username: usernameFromName,
        followerCount: 0,
        postCount: profile?.ranking_count ?? 0,
        approvalCount: profile?.approval_count ?? 0,
        status_concurseiro: profile?.status_concurseiro || 'Na Ativa',
        email: fallbackEmail,
        bio: profile?.bio || '',
        concursos_aprovados: null,
        concursos_participando: null,
        estado: '',
        formacao: '',
        cargo_atual: '',
        area_estudos: '',
        especialidade: '',
        curso_preparatorio: '',
        rotina_estudos: '',
        is_studying: profile?.is_studying || false,
        isCoach,
        isPro,
        hasActiveCoach,
        activeStudentCount,
      };
    });
  },
};
