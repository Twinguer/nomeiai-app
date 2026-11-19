import { useState, useEffect, useMemo, useCallback } from 'react';
import { toast } from 'sonner';
import { UserStudyService } from '@/services/userStudyService';
import { getScheduleSessions } from '../domain/scheduleHelpers';
import { toUiDayOfWeek } from '../domain/scheduleMode';
import { devLog } from '@/utils/productionLogger';
import type { StudyCycleV2, StudySchedule, UserStudy } from '@/types/userStudy';

export interface CronogramaStudySession {
  id: string;
  day: number;
  startTime?: string;
  endTime?: string;
  durationMinutes?: number;
  displayOrder?: number;
  disciplineName: string;
  blockName: string;
  cycleId: string;
  sessionLink?: string;
}

export interface UseCronogramaDataOptions {
  userId?: string;
  coachMode?: boolean;
  targetStudentId?: string;
}

export function mapScheduleToCronogramaSessions(userStudyData: UserStudy): CronogramaStudySession[] {
  const allSessions: CronogramaStudySession[] = [];

  getScheduleSessions(userStudyData).forEach((session) => {
    const cycle = userStudyData.study_cycles.find((c) => c.id === session.cycle_id);
    if (!cycle?.is_active) return;

    allSessions.push({
      id: session.id,
      day: toUiDayOfWeek(session.day_of_week),
      startTime: session.start_time,
      endTime: session.end_time,
      durationMinutes: session.duration_minutes,
      displayOrder: session.display_order ?? 0,
      disciplineName: session.discipline_name || 'Disciplina',
      blockName: session.block_name || 'Bloco',
      cycleId: session.cycle_id!,
      sessionLink: session.session_link || '',
    });
  });

  return allSessions;
}

export const UI_DAY_LABELS = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
] as const;

export function sortDayTasks(tasks: CronogramaStudySession[]): CronogramaStudySession[] {
  return [...tasks].sort((a, b) => {
    const orderA = a.displayOrder ?? 0;
    const orderB = b.displayOrder ?? 0;
    if (orderA !== orderB) return orderA - orderB;
    if (a.startTime && b.startTime) return a.startTime.localeCompare(b.startTime);
    if (a.startTime && !b.startTime) return -1;
    if (!a.startTime && b.startTime) return 1;
    return (a.durationMinutes ?? 0) - (b.durationMinutes ?? 0);
  });
}

export function getDayTasksForCycle(
  userStudy: UserStudy | null,
  cycleId: string | null,
  uiDay: number
): CronogramaStudySession[] {
  if (!userStudy || !cycleId) return [];

  return sortDayTasks(
    mapScheduleToCronogramaSessions(userStudy).filter(
      (session) => session.cycleId === cycleId && session.day === uiDay
    )
  );
}

function activeCyclesFrom(userStudyData: UserStudy): StudyCycleV2[] {
  return userStudyData.study_cycles?.filter((cycle) => cycle.is_active) || [];
}

export function useCronogramaData({
  userId,
  coachMode,
  targetStudentId,
}: UseCronogramaDataOptions) {
  const targetUserId = coachMode ? targetStudentId : userId;

  const [cycles, setCycles] = useState<StudyCycleV2[]>([]);
  const [sessions, setSessions] = useState<CronogramaStudySession[]>([]);
  const [userStudy, setUserStudy] = useState<UserStudy | null>(null);
  const [loading, setLoading] = useState(true);

  const applyUserStudy = useCallback((userStudyData: UserStudy) => {
    setUserStudy(userStudyData);
    setCycles(activeCyclesFrom(userStudyData));
    setSessions(mapScheduleToCronogramaSessions(userStudyData));
  }, []);

  const refreshCronogramaData = useCallback(
    async (options?: { force?: boolean }) => {
      if (!targetUserId) {
        setLoading(false);
        return;
      }

      try {
        const userStudyData = await UserStudyService.getUserStudyData(
          targetUserId,
          options?.force === true
        );

        if (!userStudyData) {
          setUserStudy(null);
          setCycles([]);
          setSessions([]);
          return;
        }

        applyUserStudy(userStudyData);
      } catch (error) {
        devLog.error('Error loading cronograma data:', error);
        toast.error('Erro ao carregar cronograma');
      } finally {
        setLoading(false);
      }
    },
    [targetUserId, applyUserStudy]
  );

  const fetchCycles = useCallback(async () => {
    await refreshCronogramaData({ force: true });
  }, [refreshCronogramaData]);

  const fetchSessions = useCallback(async () => {
    await refreshCronogramaData();
  }, [refreshCronogramaData]);

  useEffect(() => {
    if (targetUserId) {
      setLoading(true);
      refreshCronogramaData({ force: true });
    } else {
      setLoading(false);
    }
  }, [targetUserId, refreshCronogramaData]);

  const scheduleByCycleId = useMemo(() => {
    const map: Record<string, StudySchedule[]> = {};
    if (!userStudy) return map;

    getScheduleSessions(userStudy).forEach((session) => {
      if (!session.cycle_id) return;
      if (!map[session.cycle_id]) map[session.cycle_id] = [];
      map[session.cycle_id].push(session);
    });

    return map;
  }, [userStudy]);

  return {
    targetUserId,
    cycles,
    sessions,
    setSessions,
    userStudy,
    loading,
    scheduleByCycleId,
    fetchCycles,
    fetchSessions,
    refreshCronogramaData,
  };
}
