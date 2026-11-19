import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { UserStudyService } from '@/services/userStudyService';
import { StudyCycleV2, StudySchedule } from '@/types/userStudy';
import { createStudyCycleV2 } from '@/utils/userStudyHelpers';
import { generateId } from '@/lib/utils';
import { getScheduleSessions } from '../domain/scheduleHelpers';
import { recordCompletedSessionForUser } from '../services/studySessionService';
import { supabase } from '@/integrations/supabase/client';
import { coachSubscriptionService, isActiveCoachSubscription } from '@/modules/coach';
import { logger } from '@/utils/logger';
import { devLog, sanitizeForLog } from '@/utils/productionLogger';

export interface SessionData {
  id: string;
  start_time: string;
  end_time: string;
  discipline_name: string;
  block_name: string;
  session_link?: string;
  completed_sessions?: CompletedSession[];
  total_stats?: {
    total_duration_minutes: number;
    total_questions: number;
    total_correct: number;
    session_count: number;
    last_session_date?: string;
  };
}

export interface CompletedSession {
  date: string;
  duration_minutes: number;
  questions: number;
  correct_answers: number;
  notes?: string;
  course_name?: string;
  session_link?: string;
  study_type?: string;
}

export interface WeeklySchedule {
  day: number;
  sessions: SessionData[];
}

export const useStudyCyclesV2 = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [cycles, setCycles] = useState<StudyCycleV2[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Carregar ciclos do usuário
  const fetchCycles = async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    try {
      const userStudyData = await UserStudyService.getUserStudyData(user.id);
      if (userStudyData) {
        // Filtrar apenas ciclos ativos (study_cycles contém StudyCycleV2[])
        const activeCycles = (userStudyData.study_cycles ?? []).filter(
          (cycle) => cycle.is_active
        );
        setCycles(activeCycles);
      } else {
        setCycles([]);
      }
    } catch (error) {
      devLog.error('Error fetching cycles:', error);
      toast.error('Erro ao carregar ciclos');
    } finally {
      setIsLoading(false);
    }
  };

  // Criar novo ciclo
  const createCycle = async (cycleData: {
    cycle_name: string;
    exam_date: string;
    organ?: string;
    position?: string;
    edital_link?: string;
    curso_link?: string;
    video_link?: string;
    blocks?: Array<{
      id: string;
      name: string;
      disciplines: Array<{
        id: string;
        name: string;
      }>;
    }>;
    userId?: string; // ✅ NOVO: userId opcional para permitir criação por coach
  }) => {
    // Determinar qual userId usar: o passado ou o do usuário autenticado
    const targetUserId = cycleData.userId || user?.id;
    
    if (!targetUserId || !user) return null;

    // VALIDAÇÃO: Pro do aluno ou Modo Coach ativo (não aplicar ao criar ciclo para outro userId)
    if (!cycleData.userId) {
      const { data: subscription } = await supabase
        .from('user_subscriptions')
        .select('plan, is_active, expires_at')
        .eq('user_id', user.id)
        .maybeSingle();

      const hasValidExpiry =
        !subscription?.expires_at || new Date(subscription.expires_at) > new Date();
      const userIsPro =
        subscription?.plan === 'pro' &&
        subscription?.is_active === true &&
        hasValidExpiry;

      let coachActive = false;
      try {
        const coachSub = await coachSubscriptionService.getCoachSubscription(user.id);
        coachActive = isActiveCoachSubscription(coachSub);
      } catch {
        coachActive = false;
      }

      if (!userIsPro && !coachActive) {
        toast.error('Ciclos de estudo exigem plano Pro ou assinatura Modo Coach ativa.');
        navigate('/planos');
        return null;
      }
    }

    try {
      // Verificar se já existem 2 ciclos ativos (usar targetUserId)
      const userStudyData = await UserStudyService.getUserStudyData(targetUserId);
      const activeCycles = userStudyData?.study_cycles.filter(cycle => cycle.is_active) || [];
      
      if (activeCycles.length >= 2) {
        toast.error('Você já possui 2 ciclos ativos. Desative um para criar outro.');
        return null;
      }


      const newCycleData = createStudyCycleV2(
        cycleData.cycle_name,
        cycleData.exam_date,
        cycleData.organ,
        cycleData.position,
        cycleData.edital_link,
        cycleData.curso_link,
        cycleData.video_link,
        cycleData.blocks // Passar blocos para a função
      );


      // ✅ Usar targetUserId em vez de user.id
      const success = await UserStudyService.addCycle(targetUserId, newCycleData);
      
      if (success) {
        // Só recarregar se for o próprio usuário
        if (!cycleData.userId) {
          await fetchCycles();
        }
        toast.success('Ciclo criado com sucesso!');
        return newCycleData;
      } else {
        toast.error('Erro ao criar ciclo');
        return null;
      }
    } catch (error: any) {
      devLog.error('Error creating cycle:', error);
      
      // Verificar se o erro é sobre plano Free
      const errorMessage = error?.message || error?.error?.message || '';
      if (errorMessage.includes('plano Pro') || errorMessage.includes('upgrade')) {
        toast.error('Ciclos de estudos estão disponíveis apenas no plano Pro.');
        navigate('/planos');
      } else {
        toast.error('Erro ao criar ciclo de estudos');
      }
      
      return null;
    }
  };

  // Adicionar sessão ao cronograma (agora salva em study_schedule)
  const addScheduleSession = async (
    cycleId: string,
    dayOfWeek: number,
    sessionData: Omit<StudySchedule, 'id' | 'cycle_id' | 'day_of_week' | 'total_stats' | 'created_at' | 'updated_at'>,
    targetUserId?: string // ✅ NOVO: userId opcional para permitir criação por coach
  ) => {
    const userId = targetUserId || user?.id;
    if (!userId || !user) return false;

    try {
      const userStudyData = await UserStudyService.getUserStudyData(userId);
      if (!userStudyData) return false;

      const sameDaySessions = (userStudyData.study_schedule || []).filter(
        (s) => s.cycle_id === cycleId && s.day_of_week === dayOfWeek
      );
      const nextDisplayOrder =
        sessionData.duration_minutes != null
          ? Math.max(-1, ...sameDaySessions.map((s) => s.display_order ?? 0)) + 1
          : undefined;

      // ✅ Criar nova sessão com cycle_id
      const newSession = {
        id: generateId(),
        cycle_id: cycleId,
        day_of_week: dayOfWeek,
        start_time: sessionData.start_time,
        end_time: sessionData.end_time,
        duration_minutes: sessionData.duration_minutes, // Para tarefas de duração livre
        display_order: nextDisplayOrder,
        discipline_name: sessionData.discipline_name,
        block_name: sessionData.block_name,
        session_link: sessionData.session_link,
        total_stats: {
          session_count: 0,
          total_duration_minutes: 0,
          total_questions: 0,
          total_correct: 0
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // ✅ Adicionar a study_schedule
      const updatedSchedule = [...(userStudyData.study_schedule || []), newSession];

      const scheduleModeForCycle =
        sessionData.duration_minutes != null
          ? ('duration' as const)
          : sessionData.start_time && sessionData.end_time
            ? ('time' as const)
            : undefined;

      // Atualizar metadata do ciclo
      const updatedCycles = userStudyData.study_cycles.map(cycle => {
        if (cycle.id === cycleId) {
          const existingMode = cycle.schedule_data?.metadata?.schedule_mode;
          return {
            ...cycle,
            schedule_data: {
              ...cycle.schedule_data,
              metadata: {
                ...cycle.schedule_data.metadata,
                total_sessions: (cycle.schedule_data.metadata.total_sessions || 0) + 1,
                schedule_mode: existingMode ?? scheduleModeForCycle ?? 'duration',
              },
            },
          };
        }
        return cycle;
      });

      // ✅ Usar userId em vez de user.id
      const success = await UserStudyService.upsertUserStudyData(userId, {
        study_schedule: updatedSchedule,
        study_cycles: updatedCycles
      });

      if (success) {
        // Só recarregar se for o próprio usuário
        if (!targetUserId) {
          await fetchCycles();
        }
        toast.success('Tarefa adicionada ao cronograma!');
        return true;
      } else {
        toast.error('Erro ao adicionar tarefa');
        return false;
      }
    } catch (error) {
      devLog.error('Error adding session:', error);
      toast.error('Erro ao adicionar tarefa');
      return false;
    }
  };

  const recordCompletedSession = async (
    cycleId: string,
    dayOfWeek: number,
    sessionId: string,
    sessionDetails: Omit<CompletedSession, 'date'>,
    targetUserId?: string
  ) => {
    const userId = targetUserId || user?.id;
    if (!userId || !user) return false;

    const result = await recordCompletedSessionForUser(
      userId,
      cycleId,
      dayOfWeek,
      sessionId,
      sessionDetails
    );

    if (result.ok) {
      await fetchCycles();
      toast.success('Tarefa registrada com sucesso!');
      return true;
    }

    if (result.reason === 'session_not_found') {
      toast.error('Tarefa não encontrada');
    } else {
      toast.error('Erro ao registrar tarefa');
    }
    return false;
  };

  const updateScheduleSession = async (
    sessionId: string,
    updates: Partial<StudySchedule>,
    targetUserId?: string
  ) => {
    const userId = targetUserId || user?.id;
    if (!userId) return false;

    try {
      const success = await UserStudyService.updateScheduleSession(userId, sessionId, updates);

      if (success) {
        if (!targetUserId) {
          await fetchCycles();
        }
        toast.success('Tarefa atualizada!');
        return true;
      }

      toast.error('Erro ao atualizar tarefa');
      return false;
    } catch (error) {
      devLog.error('Error updating session:', error);
      toast.error('Erro ao atualizar tarefa');
      return false;
    }
  };

  // Remover sessão do cronograma (delega ao service — fonte única study_schedule)
  const removeScheduleSession = async (
    _cycleId: string,
    _dayOfWeek: number,
    sessionId: string,
    targetUserId?: string
  ) => {
    const userId = targetUserId || user?.id;
    if (!userId) return false;

    try {
      const success = await UserStudyService.removeScheduleSession(userId, sessionId);

      if (success) {
        await fetchCycles();
        toast.success('Tarefa removida!');
        return true;
      }

      toast.error('Erro ao remover tarefa');
      return false;
    } catch (error) {
      devLog.error('Error removing session:', error);
      toast.error('Erro ao remover tarefa');
      return false;
    }
  };

  // Atualizar ciclo
  const updateCycle = async (
    cycleId: string,
    updates: Partial<Omit<StudyCycleV2, 'id' | 'user_id' | 'schedule_data' | 'created_at' | 'updated_at'>>
  ) => {
    if (!user) return false;

    try {
      const success = await UserStudyService.updateCycle(user.id, cycleId, updates);
      
      if (success) {
        await fetchCycles(); // Recarregar ciclos
        toast.success('Ciclo atualizado!');
        return true;
      } else {
        toast.error('Erro ao atualizar ciclo');
        return false;
      }
    } catch (error) {
      devLog.error('Error updating cycle:', error);
      toast.error('Erro ao atualizar ciclo');
      return false;
    }
  };

  // Desativar ciclo
  const deactivateCycle = async (cycleId: string) => {
    return updateCycle(cycleId, { is_active: false });
  };

  // Obter sessões para um dia específico (compatível com ambas estruturas)
  const getSessionsForDay = async (cycleId: string, dayOfWeek: number): Promise<SessionData[]> => {
    try {
      const userStudyData = await UserStudyService.getUserStudyData(user!.id);
      if (!userStudyData) return [];

      return getScheduleSessions(userStudyData, cycleId, dayOfWeek).map((s) => ({
        id: s.id,
        start_time: s.start_time,
        end_time: s.end_time,
        discipline_name: s.discipline_name || '',
        block_name: s.block_name || '',
        session_link: s.session_link,
        total_stats: s.total_stats,
        completed_sessions: [],
      }));
    } catch (error) {
      devLog.error('Error getting sessions for day:', error);
      return [];
    }
  };

  // Obter todas as sessões de todos os ciclos para um dia
  const getAllSessionsForDay = async (dayOfWeek: number): Promise<SessionData[]> => {
    try {
      const allSessions: SessionData[] = [];
      for (const cycle of cycles) {
        const sessions = await getSessionsForDay(cycle.id, dayOfWeek);
        allSessions.push(...sessions);
      }
      return allSessions;
    } catch (error) {
      devLog.error('Error getting all sessions for day:', error);
      return [];
    }
  };

  // Remover ciclo
  const removeCycle = async (cycleId: string): Promise<boolean> => {
    if (!user) return false;

    try {
      const success = await UserStudyService.removeCycle(user.id, cycleId);
      
      if (success) {
        await fetchCycles(); // Recarregar ciclos
        toast.success('Ciclo removido com sucesso!');
        return true;
      } else {
        toast.error('Erro ao remover ciclo');
        return false;
      }
    } catch (error) {
      devLog.error('Error removing cycle:', error);
      toast.error('Erro ao remover ciclo');
      return false;
    }
  };

  useEffect(() => {
    fetchCycles();
  }, [user?.id]);

  return {
    cycles,
    isLoading,
    fetchCycles,
    createCycle,
    addScheduleSession,
    updateScheduleSession,
    recordCompletedSession,
    removeScheduleSession,
    updateCycle,
    deactivateCycle,
    removeCycle,
    getSessionsForDay,
    getAllSessionsForDay
  };
};
