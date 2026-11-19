// ============================================
// TIPOS PARA COACH MODE
// ============================================

import type { ReactNode } from 'react';

export type CoachPlanType = 'starter' | 'professional' | 'enterprise';
export type CoachSubscriptionStatus = 'active' | 'cancelled' | 'suspended' | 'expired';
export type RelationshipStatus = 'active' | 'inactive' | 'removed';
export type TaskType = 'suggested_cycle' | 'goal' | 'reminder' | 'note';
export type Priority = 'high' | 'medium' | 'low';
export type TaskStatus = 'pending' | 'accepted' | 'in_progress' | 'completed' | 'rejected';
export type InvitationStatus = 'pending' | 'accepted' | 'rejected' | 'expired' | 'cancelled';
export type AlertType = 'low_activity' | 'high_engagement' | 'task_overdue' | 'goal_achieved';
export type AlertSeverity = 'high' | 'medium' | 'low';

// ============================================
// ASSINATURA
// ============================================
export interface CoachSubscription {
  id: string;
  coach_id: string;
  plan_type: CoachPlanType;
  status: CoachSubscriptionStatus;
  max_students: number;
  current_students: number;
  price: number;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
}

// ============================================
// PERFIL DO COACH (JSONB)
// ============================================
export interface CoachProfile {
  id: string;
  coach_id: string;
  student_relationships: StudentRelationship[];
  coach_tasks: CoachTask[];
  pending_invitations: PendingInvitation[];
  team_statistics: TeamStatistics;
  alerts: CoachAlert[];
  coach_settings: CoachSettings;
  last_activity_date: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================
// RELACIONAMENTO COM ALUNO
// ============================================
export interface StudentRelationship {
  relationship_id: string;
  student_id: string;
  student_email?: string;
  student_name?: string;
  status: RelationshipStatus;

  consent_data: ConsentData;
  consent_date: string;
  joined_at: string;
  last_activity: string | null;

  notes: string;

  performance: StudentPerformance;
  goals?: Goal[];
  tags?: string[];
}

export interface ConsentData {
  study_data: boolean;
  statistics: boolean;
  profile_basic?: boolean;
}

export interface StudentPerformance {
  hours_this_week: number;
  hours_last_week: number;
  hours_total: number;

  sessions_this_week: number;
  sessions_last_week: number;

  cycles_active: number;
  cycles_completed: number;

  tasks_completed: number;
  tasks_pending: number;
  tasks_overdue: number;

  completion_rate: number;
  engagement_score: number;

  streak_current: number;
  streak_longest: number;

  last_7_days?: number[];

  subjects_focus?: SubjectFocus[];
}

export interface SubjectFocus {
  subject: string;
  hours: number;
  priority: string;
}

export interface Goal {
  goal_id: string;
  title: string;
  target_hours: number;
  current_hours: number;
  deadline: string;
  status: 'in_progress' | 'completed' | 'failed';
}

// ============================================
// TAREFAS DO COACH
// ============================================
export interface CoachTask {
  task_id: string;
  relationship_id: string;
  student_id: string;

  task_type: TaskType;

  title: string;
  description?: string;
  deadline?: string | null;
  priority: Priority;

  status: TaskStatus;

  metadata?: TaskMetadata;

  created_at: string;
  accepted_at?: string | null;
  completed_at?: string | null;
}

export interface TaskMetadata {
  suggested_cycle_data?: CycleStructure;
  focus_area?: string;
  target_value?: number;
  current_value?: number;
  unit?: string;
  reminder_frequency?: string;
  time?: string;
  note_category?: string;
  tags?: string[];
}

export interface CycleStructure {
  cycle_name: string;
  duration_weeks: number;
  blocks: CycleBlock[];
}

export interface CycleBlock {
  block_id: string;
  block_name: string;
  subjects: CycleSubject[];
}

export interface CycleSubject {
  subject_id: string;
  subject_name: string;
  hours_per_week: number;
  material?: string;
}

// ============================================
// CONVITES PENDENTES
// ============================================
export interface PendingInvitation {
  invitation_id: string;
  student_email: string;
  student_id?: string | null;
  invitation_message?: string;
  status: InvitationStatus;
  expires_at: string;
  invited_at: string;
  responded_at?: string | null;
}

// ============================================
// ESTATÍSTICAS DA EQUIPE
// ============================================
export interface TeamStatistics {
  total_active_students: number;
  total_inactive_students: number;

  total_invitations_sent: number;
  total_invitations_accepted: number;
  total_invitations_rejected: number;
  total_invitations_pending: number;
  acceptance_rate: number;

  team_total_hours_this_week: number;
  team_total_hours_last_week: number;
  team_average_hours_per_student: number;

  team_sessions_this_week: number;
  team_average_sessions_per_student: number;

  team_active_cycles: number;
  team_completed_cycles: number;

  tasks_total: number;
  tasks_completed: number;
  tasks_pending: number;
  tasks_overdue: number;
  task_completion_rate: number;

  engagement_score: number;

  alerts_count: number;
  students_needing_attention: string[];

  performance_trend?: 'improving' | 'stable' | 'declining';
  top_performers?: TopPerformer[];

  weekly_comparison?: WeeklyComparison;

  last_updated: string;
}

export interface TopPerformer {
  student_id: string;
  hours_this_week: number;
  completion_rate: number;
}

export interface WeeklyComparison {
  this_week: {
    total_hours: number;
    average_per_student: number;
    completion_rate: number;
  };
  last_week: {
    total_hours: number;
    average_per_student: number;
    completion_rate: number;
  };
  change_percent: {
    hours: number;
    average: number;
    completion: number;
  };
}

// ============================================
// ALERTAS
// ============================================
export interface CoachAlert {
  alert_id: string;
  type: AlertType;
  student_id: string;
  severity: AlertSeverity;
  message: string;

  metadata?: {
    last_activity?: string;
    days_inactive?: number;
    previous_average_hours?: number;
    target_hours?: number;
    actual_hours?: number;
    excess_percent?: number;
    task_id?: string;
    deadline?: string;
    days_overdue?: number;
  };

  created_at: string;
  acknowledged: boolean;
  acknowledged_at?: string | null;
}

// ============================================
// CONFIGURAÇÕES DO COACH
// ============================================
export interface CoachSettings {
  notifications_enabled?: boolean;
  email_notifications?: boolean;
  push_notifications?: boolean;

  auto_alerts_enabled?: boolean;
  alert_frequency?: 'daily' | 'weekly' | 'realtime';

  report_frequency?: 'weekly' | 'biweekly' | 'monthly';

  preferred_contact_method?: 'platform' | 'email' | 'whatsapp';

  business_hours?: BusinessHours;

  template_cycles?: TemplateCycle[];

  auto_invite_settings?: AutoInviteSettings;

  dashboard_preferences?: DashboardPreferences;

  created_at?: string;
  updated_at?: string;
}

export interface BusinessHours {
  [key: string]: {
    start: string;
    end: string;
    available: boolean;
  };
}

export interface TemplateCycle {
  template_id: string;
  template_name: string;
  cycle_structure: unknown;
  created_at: string;
}

export interface AutoInviteSettings {
  enabled: boolean;
  max_auto_invites_per_day: number;
}

export interface DashboardPreferences {
  default_view?: 'alerts' | 'students' | 'statistics';
  sort_by?: 'activity' | 'name' | 'performance';
  items_per_page?: number;
}

// ============================================
// TIPOS PARA FUNÇÕES
// ============================================
export interface CanInviteResponse {
  can_invite: boolean;
  reason?: string;
  current?: number;
  max?: number;
  slots_free?: number;
}

export interface AddStudentRequest {
  coach_id: string;
  student_id: string;
  consent_data: ConsentData;
}

export interface CreateTaskRequest {
  coach_id: string;
  student_id: string;
  task_type: TaskType;
  title: string;
  description?: string;
  deadline?: string;
  priority?: Priority;
  metadata?: TaskMetadata;
}

// ============================================
// TIPOS PARA COMPONENTES
// ============================================
export interface StudentCardProps {
  student: StudentRelationship;
  onViewDetails: (studentId: string) => void;
  onSendMessage: (studentId: string) => void;
  onRemove: (studentId: string) => void;
}

export interface StatsCardProps {
  title: string;
  value: string | number;
  description?: string;
  trend?: number;
  icon?: ReactNode;
}
