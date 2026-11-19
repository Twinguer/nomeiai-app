import { supabase } from '@/integrations/supabase/client';
import { generateId } from '@/lib/utils';
import { MIRROR_WEEKLY_STATS } from '@/modules/study/domain/studyWrite';
import { logger } from '@/utils/logger';
import { devLog, sanitizeForLog } from '@/utils/productionLogger';
import { 
  UserStudy, 
  StudySession, 
  StudySchedule, 
  StudyStatistics, 
  StudyCycleV2,
  StudyPlan,
  StudySubject,
  StudyGoal,
  StudyGoalsTracking,
  StudyProgress,
  StudyReminder,
  SpacedRepetitionItem,
  UserStudyDay,
  StudyContest,
  StudyDataUpdate,
  defaultUserStudy
} from '@/types/userStudy';
import { parseTimerDayTaskCompletions } from '@/utils/timerDayTaskCompletion';

/** Payload mínimo para criar linha sem sobrescrever ciclos/sessões existentes no upsert. */
function buildInitialStudyDataPatch(
  overrides: StudyDataUpdate = {}
): StudyDataUpdate {
  return {
    study_statistics: defaultUserStudy.study_statistics as StudyStatistics,
    study_plans: [],
    study_subjects: [],
    study_goals: [],
    study_goals_tracking: {},
    study_progress: [],
    study_reminders: [],
    spaced_repetition_queue: [],
    user_study_days: [],
    study_contests: [],
    ...overrides,
  };
}

function parseJsonArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function mapRowToUserStudy(data: Record<string, unknown>): UserStudy {
  const metadata = (data.study_metadata as Record<string, unknown> | null) ?? {};
  const studySessions = parseJsonArray<StudySession>(data.study_sessions);
  const studySchedule = parseJsonArray<StudySchedule>(data.study_schedule);
  const studyCycles = parseJsonArray<StudyCycleV2>(data.study_cycles);
  const studyStatistics =
    (data.study_statistics as StudyStatistics | null) ??
    (defaultUserStudy.study_statistics as StudyStatistics);

  return {
    ...(data as unknown as UserStudy),
    study_sessions: studySessions,
    study_schedule: studySchedule,
    study_cycles: studyCycles,
    study_statistics: studyStatistics,
    study_plans: parseJsonArray<StudyPlan>(metadata.study_plans),
    study_subjects: parseJsonArray<StudySubject>(metadata.study_subjects),
    study_goals: parseJsonArray<StudyGoal>(metadata.study_goals),
    study_goals_tracking:
      (metadata.study_goals_tracking as StudyGoalsTracking) ?? {},
    study_progress: parseJsonArray<StudyProgress>(metadata.study_progress),
    study_reminders: parseJsonArray<StudyReminder>(metadata.study_reminders),
    spaced_repetition_queue: parseJsonArray<SpacedRepetitionItem>(
      metadata.spaced_repetition_queue
    ),
    user_study_days: parseJsonArray<UserStudyDay>(metadata.user_study_days),
    study_contests: parseJsonArray<StudyContest>(metadata.study_contests),
    timer_day_task_completions: parseTimerDayTaskCompletions(metadata.timer_day_task_completions),
    total_sessions_count: studySessions.length,
    total_schedule_count: studySchedule.length,
  };
}

/**
 * Service for managing user study data in the consolidated user_study table
 * This service replaces direct access to multiple study tables
 */
export class UserStudyService {
  // Cache simples para otimizar carregamento
  private static cache = new Map<string, { data: UserStudy; timestamp: number }>();
  private static CACHE_DURATION = 30 * 1000; // 30 segundos

  /**
   * Get complete user study data with cache
   */
  static async getUserStudyData(userId: string, forceRefresh = false): Promise<UserStudy | null> {
    try {
      // Verificar cache primeiro
      if (!forceRefresh) {
        const cached = this.cache.get(userId);
        if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
          logger.debug('Retornando dados do cache', { userId });
          return cached.data;
        }
      }

      logger.debug('Buscando dados do usuário', { userId, forceRefresh });
      
      // Verificar autenticação atual
      const { data: { user: authUser } } = await supabase.auth.getUser();
      logger.debug('Verificação de autenticação', { 
        authUserId: authUser?.id, 
        requestedUserId: userId,
        match: authUser?.id === userId 
      });
      
      const { data, error } = await supabase
        .from('user_study_v2')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle(); // Usar maybeSingle em vez de single para evitar erro quando não há dados

      if (error) {
        // PGRST116 = nenhum resultado encontrado (normal quando usuário não tem dados ainda)
        if (error.code === 'PGRST116') {
          // Silencioso - é normal quando usuário não tem dados ainda
          return null;
        }
        // 406 = Not Acceptable (pode ser RLS Policy bloqueando)
        if (error.code === 'PGRST406' || error.status === 406) {
          logger.error('Acesso negado aos dados do usuário (possível problema de permissão)', { error, code: error.code });
          return null;
        }
        logger.error('Erro ao buscar dados do usuário', { error, code: error.code, status: error.status });
        return null;
      }

      logger.debug('Dados do usuário encontrados', { 
        hasData: !!data, 
        cyclesCount: data?.study_cycles?.length || 0 
      });
      
      // Verificar se data é null antes de acessar propriedades
      if (!data) {
        // Silencioso - é normal quando usuário não tem dados ainda
        return null;
      }
      
      const userData = mapRowToUserStudy(data as Record<string, unknown>);
      
      // Armazenar no cache
      this.cache.set(userId, { data: userData, timestamp: Date.now() });
      
      return userData;
    } catch (error) {
      logger.error('Erro na função getUserStudyData', error);
      return null;
    }
  }

  /**
   * Clear cache for a specific user
   */
  static clearCache(userId?: string): void {
    if (userId) {
      this.cache.delete(userId);
      logger.debug('Cache limpo para usuário', { userId });
    } else {
      this.cache.clear();
      logger.debug('Cache limpo para todos os usuários');
    }
  }

  /**
   * Create or update user study data
   */
  static async upsertUserStudyData(userId: string, studyData: StudyDataUpdate): Promise<boolean> {
    try {
      const { error } = await supabase.rpc('upsert_user_study_data', {
        user_uuid: userId,
        study_data: studyData
      });

      if (error) {
        devLog.error('Error upserting user study data: Database operation failed');
        return false;
      }

      // Limpar cache após atualização
      this.clearCache(userId);
      logger.debug('Cache limpo após atualização', { userId });

      return true;
    } catch (error) {
      devLog.error('Error upserting user study data: Database operation failed');
      return false;
    }
  }

  /**
   * Initialize user study data with defaults
   */
  static async initializeUserStudyData(userId: string): Promise<boolean> {
    try {
      // Usar a função RPC upsert_user_study_data para garantir que apenas uma linha seja criada
      const { error } = await supabase.rpc('upsert_user_study_data', {
        user_uuid: userId,
        study_data: buildInitialStudyDataPatch(),
      });

      if (error) {
        devLog.error('Error initializing user study data: Database operation failed');
        return false;
      }

      return true;
    } catch (error) {
      devLog.error('Error initializing user study data: Database operation failed');
      return false;
    }
  }

  // ===== STUDY SCHEDULE =====

  /**
   * Get user study schedule
   */
  static async getSchedule(userId: string): Promise<StudySchedule[]> {
    try {
      const data = await this.getUserStudyData(userId);
      return data?.study_schedule || [];
    } catch (error) {
      devLog.error('Error fetching schedule: Database operation failed');
      return [];
    }
  }

  /**
   * Add session to schedule
   */
  static async addScheduleSession(userId: string, session: Omit<StudySchedule, 'id' | 'created_at' | 'updated_at'>): Promise<boolean> {
    try {
      const newSession: StudySchedule = {
        ...session,
        id: generateId(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const data = await this.getUserStudyData(userId);
      if (!data) {
        await this.initializeUserStudyData(userId);
        const newData = await this.getUserStudyData(userId);
        if (!newData) return false;
      }

      const currentSchedule = data?.study_schedule || [];
      const updatedSchedule = [...currentSchedule, newSession];

      return await this.upsertUserStudyData(userId, {
        study_schedule: updatedSchedule
      });
    } catch (error) {
      devLog.error('Error adding schedule session: Database operation failed');
      return false;
    }
  }

  /**
   * Update schedule session
   */
  static async updateScheduleSession(userId: string, sessionId: string, updates: Partial<StudySchedule>): Promise<boolean> {
    try {
      const data = await this.getUserStudyData(userId);
      if (!data) return false;

      const updatedSchedule = data.study_schedule.map((session) => {
        if (session.id !== sessionId) return session;

        const merged: StudySchedule = {
          ...session,
          ...updates,
          updated_at: new Date().toISOString(),
        };

        if (updates.duration_minutes !== undefined) {
          delete merged.start_time;
          delete merged.end_time;
        } else if (updates.start_time !== undefined || updates.end_time !== undefined) {
          delete merged.duration_minutes;
        }

        return merged;
      });

      return await this.upsertUserStudyData(userId, {
        study_schedule: updatedSchedule
      });
    } catch (error) {
      devLog.error('Error updating schedule session: Database operation failed');
      return false;
    }
  }

  /**
   * Atualiza várias tarefas do cronograma em uma única gravação (reordenação / mudança de dia).
   */
  static async patchScheduleSessions(
    userId: string,
    patches: Array<{ id: string; day_of_week?: number; display_order?: number }>
  ): Promise<boolean> {
    if (patches.length === 0) return true;
    try {
      const data = await this.getUserStudyData(userId);
      if (!data) return false;

      const patchMap = new Map(patches.map((p) => [p.id, p]));
      const updatedSchedule = data.study_schedule.map((session) => {
        const patch = patchMap.get(session.id);
        if (!patch) return session;
        return {
          ...session,
          ...(patch.day_of_week !== undefined ? { day_of_week: patch.day_of_week } : {}),
          ...(patch.display_order !== undefined ? { display_order: patch.display_order } : {}),
          updated_at: new Date().toISOString(),
        };
      });

      return await this.upsertUserStudyData(userId, {
        study_schedule: updatedSchedule,
      });
    } catch (error) {
      devLog.error('Error patching schedule sessions: Database operation failed');
      return false;
    }
  }

  /**
   * Remove schedule session (from study_schedule or legacy structure)
   */
  static async removeScheduleSession(userId: string, sessionId: string): Promise<boolean> {
    try {
      logger.debug('Removendo sessão do cronograma', { userId, sessionId });
      
      const data = await this.getUserStudyData(userId);
      if (!data) {
        logger.error('Dados do usuário não encontrados');
        return false;
      }

      // ✅ Remover de study_schedule
      const updatedSchedule = (data.study_schedule || []).filter(s => s.id !== sessionId);

      // Encontrar cycle_id da sessão removida para atualizar metadata
      const removedSession = (data.study_schedule || []).find(s => s.id === sessionId);
      
      let updatedCycles = data.study_cycles;
      
      if (removedSession) {
        // Atualizar metadata do ciclo
        updatedCycles = data.study_cycles.map(cycle => {
          if (cycle.id === removedSession.cycle_id) {
            return {
              ...cycle,
              schedule_data: {
                ...cycle.schedule_data,
                metadata: {
                  ...cycle.schedule_data.metadata,
                  total_sessions: Math.max(0, (cycle.schedule_data.metadata.total_sessions || 1) - 1)
                }
              }
            };
          }
          return cycle;
        });
      } else if (!MIRROR_WEEKLY_STATS) {
        logger.warn('Sessão não encontrada em study_schedule (espelhamento legado desligado)', {
          sessionId,
        });
        return false;
      } else if (MIRROR_WEEKLY_STATS) {
        // Fallback legado: remover de weekly_schedule (só com espelhamento ativo)
        updatedCycles = data.study_cycles.map(cycle => {
          const updatedScheduleData = { ...cycle.schedule_data };
          
          if (updatedScheduleData.weekly_schedule) {
            updatedScheduleData.weekly_schedule = updatedScheduleData.weekly_schedule.map(daySchedule => ({
              ...daySchedule,
              sessions: daySchedule.sessions.filter(session => session.id !== sessionId)
            }));

            const totalSessions = updatedScheduleData.weekly_schedule.reduce(
              (total, day) => total + day.sessions.length, 
              0
            );

            updatedScheduleData.metadata = {
              ...updatedScheduleData.metadata,
              total_sessions: totalSessions
            };
          }

          return {
            ...cycle,
            schedule_data: updatedScheduleData
          };
        });
      }

      logger.debug('Dados atualizados após remoção', { 
        scheduleSessions: updatedSchedule.length,
        sessionRemoved: sessionId 
      });

      return await this.upsertUserStudyData(userId, {
        study_schedule: updatedSchedule,
        study_cycles: updatedCycles
      });
    } catch (error) {
      logger.error('Erro ao remover sessão do cronograma', error);
      return false;
    }
  }

  // ===== STUDY STATISTICS =====

  /**
   * Get user study statistics
   */
  static async getStatistics(userId: string): Promise<StudyStatistics | null> {
    try {
      const data = await this.getUserStudyData(userId);
      return data?.study_statistics || null;
    } catch (error) {
      devLog.error('Error fetching statistics: Database operation failed');
      return null;
    }
  }

  /**
   * Persiste estatísticas em user_study_v2 (via upsert — alinhado ao restante do app).
   */
  static async updateStatistics(userId: string, statistics: StudyStatistics): Promise<boolean> {
    return this.upsertUserStudyData(userId, {
      study_statistics: statistics,
    });
  }

  /**
   * Persiste sessões e estatísticas derivadas no mesmo write (fonte única de verdade).
   */
  static async saveSessionsAndStatistics(
    userId: string,
    studySessions: StudySession[],
    statistics: StudyStatistics
  ): Promise<boolean> {
    return this.upsertUserStudyData(userId, {
      study_sessions: studySessions,
      study_statistics: statistics,
    });
  }

  // ===== STUDY CYCLES =====

  /**
   * Get user study cycles
   */
  static async getCycles(userId: string): Promise<StudyCycleV2[]> {
    try {
      const data = await this.getUserStudyData(userId);
      return data?.study_cycles || [];
    } catch (error) {
      devLog.error('Error fetching cycles: Database operation failed');
      return [];
    }
  }

  /**
   * Add study cycle V2
   * Usuário sempre existe se chegou até aqui (autenticado)
   */
  static async addCycle(userId: string, cycle: Omit<StudyCycleV2, 'id' | 'created_at' | 'updated_at'>): Promise<boolean> {
    try {
      const newCycle: StudyCycleV2 = {
        ...cycle,
        id: generateId(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Buscar dados existentes do usuário
      const data = await this.getUserStudyData(userId);
      
      if (!data) {
        // Se não existir dados, criar com ciclo já incluído
        return await this.upsertUserStudyData(
          userId,
          buildInitialStudyDataPatch({ study_cycles: [newCycle] })
        );
      }

      // Se existir, adicionar ciclo aos existentes
      const currentCycles = data.study_cycles || [];
      const updatedCycles = [...currentCycles, newCycle];

      return await this.upsertUserStudyData(userId, {
        study_cycles: updatedCycles
      });
    } catch (error) {
      devLog.error('Error adding cycle: Database operation failed');
      return false;
    }
  }

  /**
   * Update study cycle
   */
  static async updateCycle(userId: string, cycleId: string, updates: Partial<StudyCycleV2>): Promise<boolean> {
    try {
      const data = await this.getUserStudyData(userId);
      if (!data) return false;

      const updatedCycles = data.study_cycles.map(cycle => 
        cycle.id === cycleId 
          ? { ...cycle, ...updates, updated_at: new Date().toISOString() }
          : cycle
      );

      return await this.upsertUserStudyData(userId, {
        study_cycles: updatedCycles
      });
    } catch (error) {
      devLog.error('Error updating cycle: Database operation failed');
      return false;
    }
  }

  /**
   * Remove study cycle
   */
  static async removeCycle(userId: string, cycleId: string): Promise<boolean> {
    try {
      const data = await this.getUserStudyData(userId);
      if (!data) return false;

      const updatedCycles = data.study_cycles.filter(cycle => cycle.id !== cycleId);

      return await this.upsertUserStudyData(userId, {
        study_cycles: updatedCycles
      });
    } catch (error) {
      devLog.error('Error removing cycle: Database operation failed');
      return false;
    }
  }

  // ===== STUDY PLANS =====

  /**
   * Get user study plans
   */
  static async getPlans(userId: string): Promise<StudyPlan[]> {
    try {
      const data = await this.getUserStudyData(userId);
      return data?.study_plans || [];
    } catch (error) {
      devLog.error('Error fetching plans: Database operation failed');
      return [];
    }
  }

  /**
   * Add study plan
   */
  static async addPlan(userId: string, plan: Omit<StudyPlan, 'id' | 'created_at' | 'updated_at'>): Promise<boolean> {
    try {
      const newPlan: StudyPlan = {
        ...plan,
        id: generateId(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const data = await this.getUserStudyData(userId);
      if (!data) {
        await this.initializeUserStudyData(userId);
        const newData = await this.getUserStudyData(userId);
        if (!newData) return false;
      }

      const currentPlans = data?.study_plans || [];
      const updatedPlans = [...currentPlans, newPlan];

      return await this.upsertUserStudyData(userId, {
        study_plans: updatedPlans
      });
    } catch (error) {
      devLog.error('Error adding plan: Database operation failed');
      return false;
    }
  }

  // ===== STUDY SUBJECTS =====

  /**
   * Get user study subjects
   */
  static async getSubjects(userId: string): Promise<StudySubject[]> {
    try {
      const data = await this.getUserStudyData(userId);
      return data?.study_subjects || [];
    } catch (error) {
      devLog.error('Error fetching subjects: Database operation failed');
      return [];
    }
  }

  /**
   * Add study subject
   */
  static async addSubject(userId: string, subject: Omit<StudySubject, 'id' | 'created_at' | 'updated_at'>): Promise<boolean> {
    try {
      const newSubject: StudySubject = {
        ...subject,
        id: generateId(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const data = await this.getUserStudyData(userId);
      if (!data) {
        await this.initializeUserStudyData(userId);
        const newData = await this.getUserStudyData(userId);
        if (!newData) return false;
      }

      const currentSubjects = data?.study_subjects || [];
      const updatedSubjects = [...currentSubjects, newSubject];

      return await this.upsertUserStudyData(userId, {
        study_subjects: updatedSubjects
      });
    } catch (error) {
      devLog.error('Error adding subject: Database operation failed');
      return false;
    }
  }

  // ===== STUDY GOALS =====

  /**
   * Get user study goals
   */
  static async getGoals(userId: string): Promise<StudyGoal[]> {
    try {
      const data = await this.getUserStudyData(userId);
      return data?.study_goals || [];
    } catch (error) {
      devLog.error('Error fetching goals: Database operation failed');
      return [];
    }
  }

  /**
   * Get user study goals tracking
   */
  static async getGoalsTracking(userId: string): Promise<StudyGoalsTracking> {
    try {
      const data = await this.getUserStudyData(userId);
      return data?.study_goals_tracking || {};
    } catch (error) {
      devLog.error('Error fetching goals tracking: Database operation failed');
      return {};
    }
  }

  /**
   * Update goals tracking
   */
  static async updateGoalsTracking(userId: string, tracking: StudyGoalsTracking): Promise<boolean> {
    try {
      return await this.upsertUserStudyData(userId, {
        study_goals_tracking: tracking
      });
    } catch (error) {
      devLog.error('Error updating goals tracking: Database operation failed');
      return false;
    }
  }

  // ===== STUDY PROGRESS =====

  /**
   * Get user study progress
   */
  static async getProgress(userId: string): Promise<StudyProgress[]> {
    try {
      const data = await this.getUserStudyData(userId);
      return data?.study_progress || [];
    } catch (error) {
      devLog.error('Error fetching progress: Database operation failed');
      return [];
    }
  }

  /**
   * Add study progress
   */
  static async addProgress(userId: string, progress: Omit<StudyProgress, 'id' | 'created_at' | 'updated_at'>): Promise<boolean> {
    try {
      const newProgress: StudyProgress = {
        ...progress,
        id: generateId(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const data = await this.getUserStudyData(userId);
      if (!data) {
        await this.initializeUserStudyData(userId);
        const newData = await this.getUserStudyData(userId);
        if (!newData) return false;
      }

      const currentProgress = data?.study_progress || [];
      const updatedProgress = [...currentProgress, newProgress];

      return await this.upsertUserStudyData(userId, {
        study_progress: updatedProgress
      });
    } catch (error) {
      devLog.error('Error adding progress: Database operation failed');
      return false;
    }
  }

  // ===== STUDY REMINDERS =====

  /**
   * Get user study reminders
   */
  static async getReminders(userId: string): Promise<StudyReminder[]> {
    try {
      const data = await this.getUserStudyData(userId);
      return data?.study_reminders || [];
    } catch (error) {
      devLog.error('Error fetching reminders: Database operation failed');
      return [];
    }
  }

  /**
   * Add study reminder
   */
  static async addReminder(userId: string, reminder: Omit<StudyReminder, 'id' | 'created_at' | 'updated_at'>): Promise<boolean> {
    try {
      const newReminder: StudyReminder = {
        ...reminder,
        id: generateId(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const data = await this.getUserStudyData(userId);
      if (!data) {
        await this.initializeUserStudyData(userId);
        const newData = await this.getUserStudyData(userId);
        if (!newData) return false;
      }

      const currentReminders = data?.study_reminders || [];
      const updatedReminders = [...currentReminders, newReminder];

      return await this.upsertUserStudyData(userId, {
        study_reminders: updatedReminders
      });
    } catch (error) {
      devLog.error('Error adding reminder: Database operation failed');
      return false;
    }
  }

  // ===== SPACED REPETITION =====

  /**
   * Get spaced repetition queue
   */
  static async getSpacedRepetitionQueue(userId: string): Promise<SpacedRepetitionItem[]> {
    try {
      const data = await this.getUserStudyData(userId);
      return data?.spaced_repetition_queue || [];
    } catch (error) {
      devLog.error('Error fetching spaced repetition queue: Database operation failed');
      return [];
    }
  }

  /**
   * Add item to spaced repetition queue
   */
  static async addSpacedRepetitionItem(userId: string, item: Omit<SpacedRepetitionItem, 'id' | 'created_at' | 'updated_at'>): Promise<boolean> {
    try {
      const newItem: SpacedRepetitionItem = {
        ...item,
        id: generateId(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const data = await this.getUserStudyData(userId);
      if (!data) {
        await this.initializeUserStudyData(userId);
        const newData = await this.getUserStudyData(userId);
        if (!newData) return false;
      }

      const currentQueue = data?.spaced_repetition_queue || [];
      const updatedQueue = [...currentQueue, newItem];

      return await this.upsertUserStudyData(userId, {
        spaced_repetition_queue: updatedQueue
      });
    } catch (error) {
      devLog.error('Error adding spaced repetition item: Database operation failed');
      return false;
    }
  }

  // ===== USER STUDY DAYS =====

  /**
   * Get user study days
   */
  static async getStudyDays(userId: string): Promise<UserStudyDay[]> {
    try {
      const data = await this.getUserStudyData(userId);
      return data?.user_study_days || [];
    } catch (error) {
      devLog.error('Error fetching study days: Database operation failed');
      return [];
    }
  }

  /**
   * Add study day
   */
  static async addStudyDay(userId: string, studyDate: string): Promise<boolean> {
    try {
      const newStudyDay: UserStudyDay = {
        id: generateId(),
        study_date: studyDate,
        created_at: new Date().toISOString()
      };

      const data = await this.getUserStudyData(userId);
      if (!data) {
        await this.initializeUserStudyData(userId);
        const newData = await this.getUserStudyData(userId);
        if (!newData) return false;
      }

      const currentStudyDays = data?.user_study_days || [];
      const updatedStudyDays = [...currentStudyDays, newStudyDay];

      return await this.upsertUserStudyData(userId, {
        user_study_days: updatedStudyDays
      });
    } catch (error) {
      devLog.error('Error adding study day: Database operation failed');
      return false;
    }
  }

  // ===== STUDY CONTESTS =====

  /**
   * Get user study contests
   */
  static async getContests(userId: string): Promise<StudyContest[]> {
    try {
      const data = await this.getUserStudyData(userId);
      return data?.study_contests || [];
    } catch (error) {
      devLog.error('Error fetching contests: Database operation failed');
      return [];
    }
  }

  /**
   * Add study contest
   */
  static async addContest(userId: string, contest: Omit<StudyContest, 'id' | 'created_at' | 'updated_at'>): Promise<boolean> {
    try {
      const newContest: StudyContest = {
        ...contest,
        id: generateId(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const data = await this.getUserStudyData(userId);
      if (!data) {
        await this.initializeUserStudyData(userId);
        const newData = await this.getUserStudyData(userId);
        if (!newData) return false;
      }

      const currentContests = data?.study_contests || [];
      const updatedContests = [...currentContests, newContest];

      return await this.upsertUserStudyData(userId, {
        study_contests: updatedContests
      });
    } catch (error) {
      devLog.error('Error adding contest: Database operation failed');
      return false;
    }
  }

  // ===== UTILITY METHODS =====

  /**
   * Delete all user study data
   */
  static async deleteUserStudyData(userId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('user_study')
        .delete()
        .eq('user_id', userId);

      if (error) {
        devLog.error('Error deleting user study data: Database operation failed');
        return false;
      }

      return true;
    } catch (error) {
      devLog.error('Error deleting user study data: Database operation failed');
      return false;
    }
  }

  /**
   * Check if user has study data
   */
  static async hasStudyData(userId: string): Promise<boolean> {
    try {
      const data = await this.getUserStudyData(userId);
      return data !== null;
    } catch (error) {
      devLog.error('Error checking study data: Database operation failed');
      return false;
    }
  }
}
