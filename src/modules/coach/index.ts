export * from './domain/types';
export * from './domain/studentPerformance';
export * from './domain/invitationRules';
export * from './domain/coachPlanLimits';

export {
  coachAccessService,
  type CoachStudentAccessResult,
  type CoachStudentDisplayResult,
} from './services/coachAccessService';
export { coachRelationshipService } from './services/coachRelationshipService';
export { coachSubscriptionService } from './services/coachSubscriptionService';
export { coachTaskService } from './services/coachTaskService';
export {
  coachInvitationService,
  type CoachPendingInvitation,
  type CoachInviteSearchUser,
} from './services/coachInvitationService';
export {
  fetchCoachStudentsWithDetails,
  fetchCoachStudentDetails,
  type CoachStudentListItem,
  type CoachStudentDetails,
} from './services/coachStudentListService';

export { useCoachStudentGate } from './hooks/useCoachStudentGate';
export { useCoachSubscription } from './hooks/useCoachSubscription';
export { useCoachStudents, type CoachStudentListItem as CoachStudentRow } from './hooks/useCoachStudents';
export {
  useCoachInvitations,
  useCoachInviteUserSearch,
  useSendCoachInvitation,
} from './hooks/useCoachInvitations';
export { useCoachStudentDetails } from './hooks/useCoachStudentDetails';
export { useIsActiveCoach, isActiveCoachSubscription } from './hooks/useIsActiveCoach';
export { useCoachBroadcastMessage } from './hooks/useCoachBroadcastMessage';

export { CoachPageShell, resolveCoachGateShellState } from './components/layout/CoachPageShell';
export { CoachStudyPageWrapper } from './components/layout/CoachStudyPageWrapper';
export { getCoachInitials, hasStudentLast7DaysActivity } from './components/layout/coachUtils';
export { StudentCard } from './components/dashboard/StudentCard';
export { TeamStatsStrip } from './components/dashboard/TeamStatsStrip';
export { PendingInvitationsCard } from './components/dashboard/PendingInvitationsCard';
export { BroadcastMessageDialog } from './components/dashboard/BroadcastMessageDialog';
export { default as CoachInvitationModal } from './components/invitations/CoachInvitationModal';
