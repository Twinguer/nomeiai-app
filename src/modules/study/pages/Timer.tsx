import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft } from 'lucide-react';
import { useTimer } from '@/contexts/TimerContext';
import { getPendingTimerTask } from '@/utils/timerTaskContext';
import {
  getStoredTimerCycleId,
  resolveInitialTimerCycleId,
  setStoredTimerCycleId,
} from '@/utils/timerCycleSelection';
import { useAuth } from '@/hooks/useAuth';
import { UserStudyService } from '@/services/userStudyService';
import { StudyCycleV2, StudySession, UserStudy } from '@/types/userStudy';
import { TimerDisciplineList } from '../components/TimerDisciplineList';
import { TimerDayTasksList } from '../components/TimerDayTasksList';
import { TimerControlsPanel } from '../components/TimerControlsPanel';
import {
  getDayTasksForCycle,
  UI_DAY_LABELS,
  type CronogramaStudySession,
} from '../hooks/useCronogramaData';
import type { EditalBlock } from '../components/editalTypes';
import { aggregateDisciplineStatsForCycle } from '../domain/disciplineStudyStats';
import { getTodayStudiedMinutesByTaskId } from '../domain/timerDayTaskProgress';
import { devLog } from '@/utils/productionLogger';
import { setPendingTimerTask } from '@/utils/timerTaskContext';
import {
  pruneTimerDayCompletedTaskIds,
  readTimerDayCompletedTaskIdsFromUserStudy,
  resolveTimerDayCompletedTaskIds,
  setsEqual,
} from '@/utils/timerDayTaskCompletion';
import {
  mergeTimerDayCompletionsIntoUserStudy,
  persistTimerDayTaskCompletions,
} from '@/modules/study/services/timerDayTaskCompletionService';

interface TimerProps {
  cycleId?: string;
  secureToken?: string;
}

const Timer = ({ cycleId: secureCycleId, secureToken }: TimerProps = {}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { token: urlToken } = useParams();
  const pendingTask = useMemo(() => getPendingTimerTask(), []);
  const [cycles, setCycles] = useState<StudyCycleV2[]>([]);
  const [userStudy, setUserStudy] = useState<UserStudy | null>(null);
  const [studySessions, setStudySessions] = useState<StudySession[]>([]);
  const [activeCycleId, setActiveCycleId] = useState<string | null>(null);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(
    () => pendingTask?.scheduleSessionId ?? null
  );
  const [completedTaskIds, setCompletedTaskIds] = useState<Set<string>>(() => new Set());
  const [loadingDisciplines, setLoadingDisciplines] = useState(true);

  const todayUiDay = useMemo(() => new Date().getDay(), []);
  const todayDayLabel = UI_DAY_LABELS[todayUiDay];
  const ownerUserId = pendingTask?.ownerUserId ?? user?.id;
  const todayTasks = useMemo(
    () => getDayTasksForCycle(userStudy, activeCycleId, todayUiDay),
    [userStudy, activeCycleId, todayUiDay]
  );
  const todayTaskIdsKey = useMemo(
    () => todayTasks.map((task) => task.id).join('|'),
    [todayTasks]
  );

  useEffect(() => {
    if (!ownerUserId || !activeCycleId) {
      setCompletedTaskIds(new Set());
      return;
    }

    const validTaskIds = todayTaskIdsKey.split('|').filter(Boolean);
    const fromServer = readTimerDayCompletedTaskIdsFromUserStudy(userStudy, activeCycleId);
    const resolved = resolveTimerDayCompletedTaskIds({
      userStudy,
      ownerUserId,
      cycleId: activeCycleId,
      validTaskIds,
    });

    setCompletedTaskIds(resolved);

    const prunedServer = pruneTimerDayCompletedTaskIds(fromServer, validTaskIds);
    if (!setsEqual(resolved, prunedServer)) {
      void persistTimerDayTaskCompletions({
        ownerUserId,
        cycleId: activeCycleId,
        taskIds: resolved,
      }).then((ok) => {
        if (ok) {
          setUserStudy((prev) =>
            prev ? mergeTimerDayCompletionsIntoUserStudy(prev, activeCycleId, resolved) : prev
          );
        }
      });
    }
  }, [ownerUserId, activeCycleId, todayTaskIdsKey, userStudy?.timer_day_task_completions]);

  const activeTask = useMemo(
    () => todayTasks.find((task) => task.id === activeTaskId) ?? null,
    [todayTasks, activeTaskId]
  );
  const activeFocusTask = useMemo(() => {
    if (activeTask) {
      return {
        disciplineName: activeTask.disciplineName,
        blockName: activeTask.blockName,
      };
    }
    if (pendingTask && pendingTask.scheduleSessionId === activeTaskId) {
      return {
        disciplineName: pendingTask.disciplineName,
        blockName: pendingTask.blockName,
      };
    }
    return null;
  }, [activeTask, pendingTask, activeTaskId]);
  const studiedMinutesByTaskId = useMemo(
    () =>
      getTodayStudiedMinutesByTaskId(studySessions, {
        cycleId: activeCycleId,
      }),
    [studySessions, activeCycleId]
  );

  const lockCycleSelection = Boolean(pendingTask?.cycleId);
  const activeCycle = cycles.find((item) => item.id === activeCycleId) ?? null;
  const disciplineBlocks = (activeCycle?.schedule_data?.available_blocks as EditalBlock[]) ?? [];
  const disciplineStats = useMemo(
    () =>
      activeCycleId
        ? aggregateDisciplineStatsForCycle(studySessions, activeCycleId)
        : {},
    [studySessions, activeCycleId]
  );

  useEffect(() => {
    let cancelled = false;

    const loadCycles = async () => {
      if (!ownerUserId) {
        setCycles([]);
        setUserStudy(null);
        setStudySessions([]);
        setActiveCycleId(null);
        setLoadingDisciplines(false);
        return;
      }

      setLoadingDisciplines(true);

      try {
        const userStudyData = await UserStudyService.getUserStudyData(ownerUserId);
        if (cancelled) return;

        const availableCycles = userStudyData?.study_cycles ?? [];
        setUserStudy(userStudyData);
        setCycles(availableCycles);
        setStudySessions(userStudyData?.study_sessions ?? []);

        const initialCycleId = resolveInitialTimerCycleId({
          secureCycleId,
          pendingTaskCycleId: pendingTask?.cycleId,
          storedCycleId: getStoredTimerCycleId(),
          availableCycleIds: availableCycles.map((item) => item.id),
        });

        setActiveCycleId(initialCycleId);
        if (initialCycleId) setStoredTimerCycleId(initialCycleId);
      } catch (error) {
        devLog.error('Erro ao carregar disciplinas do timer:', error);
        if (!cancelled) {
          setCycles([]);
          setUserStudy(null);
          setStudySessions([]);
          setActiveCycleId(null);
        }
      } finally {
        if (!cancelled) setLoadingDisciplines(false);
      }
    };

    loadCycles();

    return () => {
      cancelled = true;
    };
  }, [ownerUserId, secureCycleId, pendingTask?.cycleId]);

  const cronogramaPath =
    pendingTask?.returnPath ??
    (secureToken ?? urlToken ? `/estudos/cronograma/${secureToken ?? urlToken}` : '/estudos/cronograma');
  const {
    minutes,
    seconds,
    isRunning,
    isPaused,
    initialMinutes,
    startTimer,
    pauseTimer,
    resumeTimer,
    stopTimer,
    setInitialTime,
  } = useTimer();

  const handleCycleChange = (cycleId: string) => {
    setActiveCycleId(cycleId);
    setStoredTimerCycleId(cycleId);
    setActiveTaskId(null);
  };

  const handleToggleTaskDone = (taskId: string, done: boolean) => {
    setCompletedTaskIds((prev) => {
      const next = new Set(prev);
      if (done) next.add(taskId);
      else next.delete(taskId);

      if (ownerUserId && activeCycleId) {
        void persistTimerDayTaskCompletions({
          ownerUserId,
          cycleId: activeCycleId,
          taskIds: next,
        }).then((ok) => {
          if (ok) {
            setUserStudy((current) =>
              current
                ? mergeTimerDayCompletionsIntoUserStudy(current, activeCycleId, next)
                : current
            );
          }
        });
      }

      return next;
    });
  };

  const handleSelectDayTask = (task: CronogramaStudySession) => {
    if (!ownerUserId || !activeCycleId) return;

    setActiveTaskId(task.id);
    setPendingTimerTask({
      scheduleSessionId: task.id,
      disciplineName: task.disciplineName,
      blockName: task.blockName,
      cycleId: task.cycleId,
      dayOfWeek: task.day,
      returnPath: cronogramaPath,
      plannedDurationMinutes: task.durationMinutes,
      ownerUserId,
    });

    if (task.durationMinutes && task.durationMinutes >= 5) {
      setInitialTime(Math.min(task.durationMinutes, 360));
    }
  };

  const handleStart = () => {
    startTimer(initialMinutes);
  };

  const addTime = () => {
    if (initialMinutes < 360) {
      // 6 hours limit
      const newTime = initialMinutes + 5;
      setInitialTime(newTime);
    }
  };

  const removeTime = () => {
    if (initialMinutes > 5) {
      // Minimum 5 minutes
      const newTime = initialMinutes - 5;
      setInitialTime(newTime);
    }
  };
  const getProgressPercentage = () => {
    const totalSeconds = initialMinutes * 60;
    if (totalSeconds <= 0) return 0;
    const remainingSeconds = minutes * 60 + seconds;
    return ((totalSeconds - remainingSeconds) / totalSeconds) * 100;
  };

  const isFocusMode = isRunning;

  const timerControls = (
    <TimerControlsPanel
      minutes={minutes}
      seconds={seconds}
      initialMinutes={initialMinutes}
      isRunning={isRunning}
      isPaused={isPaused}
      progressPercent={getProgressPercentage()}
      focusMode={isFocusMode}
      activeTask={activeFocusTask}
      onStart={handleStart}
      onPause={pauseTimer}
      onResume={resumeTimer}
      onStop={stopTimer}
      onAddTime={addTime}
      onRemoveTime={removeTime}
      canRemoveTime={initialMinutes > 5}
      canAddTime={initialMinutes < 360}
    />
  );

  if (isFocusMode) {
    return (
      <div className="flex min-h-[calc(100dvh-3.5rem)] w-full items-center justify-center bg-gradient-to-b from-background via-background to-primary/[0.05] px-6 py-8">
        <div className="w-full max-w-xl">{timerControls}</div>
      </div>
    );
  }

  return (
    <>
      <div className="container mx-auto p-6">
        <div className="max-w-6xl mx-auto">
          <Button
            type="button"
            variant="ghost"
            className="mb-4 -ml-2"
            onClick={() => navigate(cronogramaPath)}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar ao cronograma
          </Button>

          {timerControls}

          {cycles.length > 1 && (
            <div className="mb-4 space-y-2 max-w-md">
              <label className="text-sm font-medium text-foreground">Ciclo de estudos</label>
              <Select
                value={activeCycleId ?? undefined}
                onValueChange={handleCycleChange}
                disabled={lockCycleSelection || loadingDisciplines}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um ciclo" />
                </SelectTrigger>
                <SelectContent>
                  {cycles.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.cycle_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {lockCycleSelection && (
                <p className="text-xs text-muted-foreground">
                  Ciclo fixado pela tarefa aberta no cronograma.
                </p>
              )}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2 md:items-start">
            <TimerDayTasksList
              tasks={todayTasks}
              dayLabel={todayDayLabel}
              cycleName={activeCycle?.cycle_name}
              activeTaskId={activeTaskId ?? undefined}
              completedTaskIds={completedTaskIds}
              studiedMinutesByTaskId={studiedMinutesByTaskId}
              onSelectTask={handleSelectDayTask}
              onToggleTaskDone={handleToggleTaskDone}
              loading={loadingDisciplines}
            />

            <TimerDisciplineList
              blocks={disciplineBlocks}
              disciplineStats={disciplineStats}
              cycleName={activeCycle?.cycle_name}
              highlightDisciplineName={activeTask?.disciplineName}
              highlightBlockName={activeTask?.blockName}
              loading={loadingDisciplines}
            />
          </div>
        </div>
      </div>

    </>
  );
};
export default Timer;