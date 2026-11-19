import { supabase } from '@/integrations/supabase/client';
import type { GroupPost, GroupComment } from '../domain/types';
import { validateGroupContent, validateGroupPostAttachments } from '../domain/groupContentSecurity';
import { logError, logWarn } from '@/utils/secureLogger';

export const studyGroupPostsService = {
  async getGroupFeed(groupId: string, limit: number = 20, offset: number = 0): Promise<GroupPost[]> {
    try {
      const { data, error } = await supabase.rpc('get_group_feed', {
        p_group_id: groupId,
        p_limit: limit,
        p_offset: offset,
      });

      if (error) {
        logError('Error in get_group_feed RPC', error, 'STUDY_GROUPS');
        throw error;
      }

      if (!data) return [];

      let posts: unknown[] = [];

      if (typeof data === 'string') {
        try {
          const parsed = JSON.parse(data);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && parsed.error) {
            logWarn('Access denied to group feed', { error: parsed.error }, 'STUDY_GROUPS');
            throw new Error(parsed.error || 'Acesso negado ao conteúdo do grupo');
          }
          posts = parsed;
        } catch (e) {
          if (e instanceof Error && e.message.includes('Acesso negado')) throw e;
          logError('Error parsing JSON string from get_group_feed', e, 'STUDY_GROUPS');
          return [];
        }
      } else if (Array.isArray(data)) {
        posts = data;
      } else if (data && typeof data === 'object') {
        if ((data as { error?: string }).error) {
          logWarn('Access denied to group feed', { error: (data as { error?: string }).error }, 'STUDY_GROUPS');
          throw new Error((data as { error?: string }).error || 'Acesso negado ao conteúdo do grupo');
        }
        logWarn('Unexpected data format from get_group_feed', { dataType: typeof data }, 'STUDY_GROUPS');
        return [];
      }

      return posts as GroupPost[];
    } catch (error) {
      logError('Error fetching group feed', error, 'STUDY_GROUPS');
      return [];
    }
  },

  async createPost(
    groupId: string,
    content?: string,
    attachments?: Array<{ url: string; type: 'image' | 'pdf'; name: string }>
  ): Promise<GroupPost | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const contentValidation = validateGroupContent(content || '', {
        allowEmpty: Boolean(attachments?.length),
      });
      if (!contentValidation.ok) {
        throw new Error(contentValidation.error);
      }

      const attachmentValidation = validateGroupPostAttachments(groupId, attachments);
      if (!attachmentValidation.ok) {
        throw new Error(attachmentValidation.error);
      }

      const { data, error } = await supabase.rpc('add_group_post', {
        p_group_id: groupId,
        p_author_id: user.id,
        p_content: contentValidation.value,
        p_attachments: attachmentValidation.value.length > 0
          ? attachmentValidation.value as unknown
          : null,
      });

      if (error) throw error;

      const result = data as { success?: boolean; post?: GroupPost; error?: string };
      if (result?.success === false) {
        throw new Error(result.error || 'Erro ao criar post');
      }

      if (!result?.post) {
        throw new Error('Resposta inválida ao criar post');
      }

      return result.post;
    } catch (error) {
      logError('Error creating post', error, 'STUDY_GROUPS');
      throw error;
    }
  },

  async addComment(
    groupId: string,
    postId: string,
    content: string,
    parentCommentId?: string
  ): Promise<GroupComment | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const contentValidation = validateGroupContent(content);
      if (!contentValidation.ok) {
        throw new Error(contentValidation.error);
      }

      const { data, error } = await supabase.rpc('add_post_comment', {
        p_group_id: groupId,
        p_post_id: postId,
        p_author_id: user.id,
        p_content: contentValidation.value,
        p_parent_comment_id: parentCommentId || null,
      });

      if (error) {
        logError('Error in add_post_comment RPC', error, 'STUDY_GROUPS');
        throw error;
      }

      const result = data as { success?: boolean; comment?: GroupComment; error?: string };
      if (result?.success) {
        return result.comment || null;
      }

      const errorMsg = result?.error || 'Erro desconhecido ao adicionar comentário';
      logError('Error from add_post_comment', new Error(errorMsg), 'STUDY_GROUPS');
      throw new Error(errorMsg);
    } catch (error) {
      logError('Error adding comment', error, 'STUDY_GROUPS');
      throw error;
    }
  },

  async cleanupExpiredPosts(groupId: string): Promise<boolean> {
    try {
      const { error } = await supabase.rpc('cleanup_expired_posts', { p_group_id: groupId });
      if (error) throw error;
      return true;
    } catch (error) {
      logError('Error cleaning up expired posts', error, 'STUDY_GROUPS');
      return false;
    }
  },
};
