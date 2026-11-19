// ============================================
// TIPOS PARA STUDY GROUPS + COMUNIDADE
// ============================================

export type PrivacyLevel = 'public' | 'private' | 'invite_only';
export type GroupMemberRole = 'member' | 'moderator' | 'admin' | 'coach';
export type GroupMemberStatus = 'active' | 'invited' | 'pending' | 'requested' | 'left' | 'removed';

export interface StudyGroup {
  id: string;
  name: string;
  description?: string;
  cover_image_url?: string;
  privacy_level: PrivacyLevel;
  max_members: number;
  current_members: number;
  focus_area?: string;
  target_concurso_id?: string;
  coach_id?: string;
  created_by: string;
  posts_data: GroupPost[];
  group_settings: Record<string, unknown>;
  post_retention_days: number;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface GroupMember {
  id: string;
  group_id?: string;
  user_id?: string;
  name: string;
  avatar_url?: string;
  role: GroupMemberRole;
  status?: GroupMemberStatus;
  joined_at: string;
}

export interface PostAttachment {
  url: string;
  type: 'image' | 'pdf';
  name: string;
}

export interface GroupPost {
  id: string;
  author_id: string;
  content: string;
  comments_count: number;
  comments: GroupComment[];
  is_pinned: boolean;
  is_deleted: boolean;
  expires_at: string;
  created_at: string;
  attachments?: PostAttachment[];
  author_name?: string;
  author_avatar?: string;
}

export interface GroupComment {
  id: string;
  author_id: string;
  content: string;
  parent_comment_id?: string;
  created_at: string;
  author_name?: string;
  author_avatar?: string;
}

export interface CreateGroupInput {
  name: string;
  description?: string;
  cover_image_url?: string;
  privacy_level?: PrivacyLevel;
  max_members?: number;
  focus_area?: string;
  target_concurso_id?: string;
  post_retention_days?: number;
}

export interface UpdateGroupInput {
  name?: string;
  description?: string;
  cover_image_url?: string;
  privacy_level?: PrivacyLevel;
  max_members?: number;
  focus_area?: string;
  post_retention_days?: number;
}

export type CommunityUserProfile = {
  id: string;
  name: string;
  nickname: string | null;
  publicHandle: string | null;
  avatar_url: string;
  username: string;
  followerCount: number;
  postCount: number;
  approvalCount: number;
  status_concurseiro: string;
  email: string;
  bio: string;
  concursos_aprovados: null;
  concursos_participando: null;
  estado: string;
  formacao: string;
  cargo_atual: string;
  area_estudos: string;
  especialidade: string;
  curso_preparatorio: string;
  rotina_estudos: string;
  is_studying: boolean;
  isCoach: boolean;
  isPro: boolean;
  hasActiveCoach: boolean;
  activeStudentCount: number;
};
