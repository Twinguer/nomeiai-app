// Types for user_study table and related study data structures

export interface StudySession {
  id: string;
  schedule_session_id?: string;
  session_link?: string;
  
  // Aceitar ambos os formatos (antigo e novo)
  total_duration_minutes?: number;  // Formato antigo
  duration_minutes?: number;         // Formato novo (banco)
  
  total_questions?: number;          // Formato antigo
  questions?: number;                // Formato novo (banco)
  
  total_correct_answers?: number;    // Formato antigo
  correct_answers?: number;          // Formato novo (banco)
  
  session_count: number;
  
  last_session_date?: string;        // Formato antigo
  session_date?: string;             // Formato antigo
  date?: string;                     // Formato novo (banco)
  
  start_time: string;
  end_time?: string;
  notes?: string;
  study_type?: string;
  quality_rating?: number;
  
  discipline_name?: string;          // Campo crítico para disciplinas
  course_name?: string;
  
  study_plan_id?: string;
  subject_id?: string;
  study_contest_id?: string;
  created_at: string;
  updated_at?: string;
}

export interface StudySchedule {
  id: string;
  schedule_session_id?: string;
  cycle_id?: string; // ✅ Referência ao ciclo
  day_of_week: number;
  start_time?: string; // Opcional para tarefas de duração livre
  end_time?: string; // Opcional para tarefas de duração livre
  duration_minutes?: number; // Para tarefas de duração livre (sem horário fixo)
  display_order?: number; // Ordem manual (modo tempo de estudos)
  is_active?: boolean;
  discipline_name?: string;
  block_name?: string;
  session_link?: string;
  study_plan_id?: string;
  subject_id?: string;
  
  // Stats consolidados da sessão
  total_stats?: {
    session_count: number;
    total_duration_minutes: number;
    total_questions: number;
    total_correct: number;
    last_session_date?: string;
  };
  
  created_at: string;
  updated_at?: string;
}

export interface StudyStatistics {
  totalHours: number;
  totalSessions: number;
  questionsAnswered: number;
  correctAnswers: number;
  wrongAnswers: number;
  currentStreak: number;
  longestStreak: number;
  lastStudyDate: string | null;
  dailyStats: Record<string, { hours: number; sessions: number }>;
  weeklyStats: Record<string, { hours: number; sessions: number }>;
  monthlyStats: Record<string, { hours: number; sessions: number }>;
  averages: {
    dailyHours: number;
    weeklyHours: number;
    monthlyHours: number;
  };
  sessionHistory: Array<{
    date: string;
    /** Duração em minutos */
    duration: number;
    type: 'timer' | 'manual';
    subject?: string;
    questions?: number;
    correctAnswers?: number;
  }>;
  subjectStats: Record<string, {
    totalHours: number;
    totalSessions: number;
    questionsAnswered: number;
    correctAnswers: number;
    wrongAnswers: number;
  }>;
  lastUpdated: string | null;
}

// StudyCycle interface removed - using StudyCycleV2 instead

export interface StudyCycleV2 {
  id: string;
  cycle_name: string;
  exam_date: string;
  organ?: string;
  position?: string;
  edital_link?: string;
  curso_link?: string;
  video_link?: string;
  trilha_semanal_pdf_url?: string;
  subjetiva_pdf_url?: string;
  trilha_semanal_label?: string;
  subjetiva_label?: string;
  is_active: boolean;
  schedule_data: {
    metadata: {
      total_sessions: number;
      total_hours: number;
      /** 'duration' = tempo de estudos (padrão, permite drag); 'time' = horário fixo */
      schedule_mode?: 'duration' | 'time';
    };
    weekly_schedule?: Array<{ // ⚠️ DEPRECATED: Usar study_schedule table
      day: number;
      sessions: Array<{
        id: string;
        start_time: string;
        end_time: string;
        discipline_name: string;
        block_name: string;
        session_link?: string;
        study_plan_id?: string;
        subject_id?: string;
        completed_sessions?: Array<{
          date: string;
          duration_minutes: number;
          questions: number;
          correct_answers: number;
          notes?: string;
        }>;
        total_stats?: {
          total_duration_minutes: number;
          total_questions: number;
          total_correct: number;
          session_count: number;
          last_session_date?: string;
        };
        created_at?: string;
        updated_at?: string;
      }>;
    }>;
    available_blocks: Array<{
      id: string;
      name: string;
      disciplines: Array<{
        id: string;
        name: string;
      }>;
    }>;
    available_disciplines: Array<{
      id: string;
      name: string;
      block_name: string;
    }>;
  };
  created_at: string;
  updated_at?: string;
}

export interface StudyPlan {
  id: string;
  title: string;
  description?: string;
  start_date: string;
  end_date?: string;
  daily_goal_hours: number;
  weekly_goal_hours: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface StudySubject {
  id: string;
  name: string;
  color: string;
  priority: number;
  weekly_hours: number;
  is_active: boolean;
  block_name?: string;
  is_completed?: boolean;
  estimated_hours?: number;
  created_at: string;
  updated_at: string;
}

export interface StudyGoal {
  id: string;
  goal_type: string;
  target_value: number;
  current_value: number;
  unit_type: string;
  target_date?: string;
  description?: string;
  is_completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface StudyGoalsTracking {
  daily?: {
    goal_type: string;
    target_hours: number;
    current_streak: number;
    longest_streak: number;
    last_activity_date?: string;
    is_active: boolean;
  };
  weekly?: {
    goal_type: string;
    target_hours: number;
    current_streak: number;
    longest_streak: number;
    last_activity_date?: string;
    is_active: boolean;
  };
}

export interface StudyProgress {
  id: string;
  subject_id?: string;
  progress_date: string;
  hours_studied: number;
  topics_completed: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface StudyReminder {
  id: string;
  title: string;
  description?: string;
  reminder_time?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SpacedRepetitionItem {
  id: string;
  subject_name: string;
  block_name?: string;
  difficulty_level: number;
  next_review_date: string;
  review_count: number;
  last_reviewed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface UserStudyDay {
  id: string;
  study_date: string;
  created_at: string;
}

export interface StudyContest {
  id: string;
  title: string;
  description?: string;
  start_date: string;
  end_date?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Main UserStudy interface
export interface UserStudy {
  id: string;
  user_id: string;
  study_sessions: StudySession[];
  study_schedule: StudySchedule[];
  study_statistics: StudyStatistics;
  study_cycles: StudyCycleV2[];
  study_plans: StudyPlan[];
  study_subjects: StudySubject[];
  study_goals: StudyGoal[];
  study_goals_tracking: StudyGoalsTracking;
  study_progress: StudyProgress[];
  study_reminders: StudyReminder[];
  spaced_repetition_queue: SpacedRepetitionItem[];
  user_study_days: UserStudyDay[];
  study_contests: StudyContest[];
  timer_day_task_completions?: Record<string, Record<string, string[]>>;
  last_activity_date?: string;
  total_sessions_count: number;
  total_schedule_count: number;
  created_at: string;
  updated_at: string;
}

// Default values for new user study data
export const defaultUserStudy: Partial<UserStudy> = {
  study_sessions: [],
  study_schedule: [],
  study_statistics: {
    totalHours: 0,
    totalSessions: 0,
    questionsAnswered: 0,
    correctAnswers: 0,
    wrongAnswers: 0,
    currentStreak: 0,
    longestStreak: 0,
    lastStudyDate: null,
    dailyStats: {},
    weeklyStats: {},
    monthlyStats: {},
    averages: {
      dailyHours: 0,
      weeklyHours: 0,
      monthlyHours: 0
    },
    sessionHistory: [],
    subjectStats: {},
    lastUpdated: null
  },
  study_cycles: [],
  study_plans: [],
  study_subjects: [],
  study_goals: [],
  study_goals_tracking: {},
  study_progress: [],
  study_reminders: [],
  spaced_repetition_queue: [],
  user_study_days: [],
  study_contests: [],
  total_sessions_count: 0,
  total_schedule_count: 0
};

// Helper types for service methods
export interface SessionProgress {
  duration: number;
  questions: number;
  correctAnswers: number;
  notes?: string;
  courseName?: string;
  studyType?: 'pdf' | 'video';
}

export interface StudyDataUpdate {
  study_sessions?: StudySession[];
  study_schedule?: StudySchedule[];
  study_statistics?: StudyStatistics;
  study_cycles?: StudyCycleV2[];
  study_plans?: StudyPlan[];
  study_subjects?: StudySubject[];
  study_goals?: StudyGoal[];
  study_goals_tracking?: StudyGoalsTracking;
  study_progress?: StudyProgress[];
  study_reminders?: StudyReminder[];
  spaced_repetition_queue?: SpacedRepetitionItem[];
  user_study_days?: UserStudyDay[];
  study_contests?: StudyContest[];
}

