export * from './domain/types';
export * from './domain/communityProfileRules';
export * from './domain/communityUserSort';
export * from './domain/groupVisibilityRules';

export { communityProfileService } from './services/communityProfileService';
export { studyGroupService } from './services/studyGroupService';
export { studyGroupMembersService } from './services/studyGroupMembersService';
export { studyGroupPostsService } from './services/studyGroupPostsService';

export { useCommunityUsers } from './hooks/useCommunityUsers';
export { useStudyGroups, useStudyGroup, useCreateGroup } from './hooks/useStudyGroups';
export {
  useGroupMembers,
  useIsGroupMember,
  useRequestToJoin,
  useLeaveGroup,
  useUserGroups,
} from './hooks/useGroupMembers';
export { useGroupFeed, useCreatePost, useAddComment } from './hooks/useGroupPosts';
export { usePendingRequests, useRespondToRequest, useInviteUser } from './hooks/useGroupRequests';

export { CommunityLoadingState } from './components/shared/CommunityLoadingState';
export { CommunityErrorState } from './components/shared/CommunityErrorState';
export { CommunityEmptyState } from './components/shared/CommunityEmptyState';
export { CommunitySectionHeader } from './components/shared/CommunitySectionHeader';
export { UserGrid } from './components/users/UserGrid';
export { UserCard, type CommunityUserProfile } from './components/users/UserCard';
export { communityCoachCardTheme } from './components/users/communityCoachCardTheme';

export { GroupsTab } from './components/groups/GroupsTab';
export { CoachGroupsTab } from './components/groups/CoachGroupsTab';
export { GroupsGrid } from './components/groups/GroupsGrid';
export { GroupCard } from './components/groups/GroupCard';
export { CreateGroupModal } from './components/groups/CreateGroupModal';
export { PostCard } from './components/groups/PostCard';
export { CreatePostForm } from './components/groups/CreatePostForm';
export { CommentSection } from './components/groups/CommentSection';
export { GroupMembersColumn } from './components/groups/GroupMembersColumn';
export { GroupSettingsButton } from './components/groups/GroupSettingsButton';
export { GroupSettingsModal } from './components/groups/GroupSettingsModal';

export { default as CommunityPage } from './pages/CommunityPage';
export { GroupDetailsPage } from './pages/GroupDetailsPage';
