import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { CalendarDays, Clock } from 'lucide-react';
import type { CronogramaStudySession } from '../hooks/useCronogramaData';
import { formatTaskProgressLabel } from '../domain/timerDayTaskProgress';

interface TimerDayTasksListProps {
  tasks: CronogramaStudySession[];
  dayLabel: string;
  cycleName?: string;
  activeTaskId?: string;
  completedTaskIds?: ReadonlySet<string>;
  studiedMinutesByTaskId?: Record<string, number>;
  onSelectTask?: (task: CronogramaStudySession) => void;
  onToggleTaskDone?: (taskId: string, done: boolean) => void;
  loading?: boolean;
  className?: string;
}

export function TimerDayTasksList({
  tasks,
  dayLabel,
  cycleName,
  activeTaskId,
  completedTaskIds,
  studiedMinutesByTaskId = {},
  onSelectTask,
  onToggleTaskDone,
  loading = false,
  className = '',
}: TimerDayTasksListProps) {
  const doneCount = tasks.filter((task) => completedTaskIds?.has(task.id)).length;
  const studiedTodayTotal = tasks.reduce(
    (sum, task) => sum + (studiedMinutesByTaskId[task.id] ?? 0),
    0
  );
  if (loading) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <CalendarDays className="h-5 w-5" />
            Tarefas de hoje
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded w-3/4" />
            <div className="h-4 bg-muted rounded w-1/2" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <CalendarDays className="h-5 w-5" />
          Tarefas de hoje
        </CardTitle>
        <p className="text-sm text-muted-foreground">{dayLabel}</p>
        {cycleName && <p className="text-xs text-muted-foreground truncate">{cycleName}</p>}
        <p className="text-xs text-muted-foreground">
          {tasks.length === 0
            ? 'Nenhuma tarefa planejada para este dia'
            : doneCount > 0
              ? `${doneCount} de ${tasks.length} concluídas`
              : `${tasks.length} ${tasks.length === 1 ? 'tarefa' : 'tarefas'} no cronograma`}
          {tasks.length > 0 && studiedTodayTotal > 0 && (
            <span>{` · ${studiedTodayTotal} min estudados hoje`}</span>
          )}
        </p>
      </CardHeader>
      <CardContent className="p-0">
        {tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4 px-4">
            Adicione tarefas ao cronograma para este dia da semana.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {tasks.map((task) => {
              const isActive = activeTaskId === task.id;
              const isDone = completedTaskIds?.has(task.id) ?? false;
              const studiedMinutes = studiedMinutesByTaskId[task.id] ?? 0;
              const progressLabel = formatTaskProgressLabel(task, studiedMinutes);

              return (
                <li
                  key={task.id}
                  className={`flex items-start gap-3 px-4 py-3 transition-colors ${
                    isActive ? 'bg-primary/10 ring-1 ring-inset ring-primary/30' : 'hover:bg-muted/40'
                  }`}
                >
                  <Checkbox
                    className="mt-1 shrink-0"
                    checked={isDone}
                    onCheckedChange={(checked) => onToggleTaskDone?.(task.id, checked === true)}
                    aria-label={`Marcar ${task.disciplineName} como concluída`}
                  />
                  <button
                    type="button"
                    onClick={() => onSelectTask?.(task)}
                    className="flex flex-1 min-w-0 items-start gap-3 text-left"
                  >
                    <Clock className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-medium text-sm truncate ${
                            isDone ? 'line-through text-muted-foreground' : ''
                          }`}
                        >
                          {task.disciplineName}
                        </span>
                        {isActive && !isDone && (
                          <span className="text-[10px] uppercase tracking-wide text-primary shrink-0">
                            Agora
                          </span>
                        )}
                      </div>
                      <p
                        className={`text-xs truncate ${
                          isDone ? 'text-muted-foreground/70 line-through' : 'text-muted-foreground'
                        }`}
                      >
                        {task.blockName}
                      </p>
                      <p
                        className={`text-xs mt-1 ${
                          studiedMinutes > 0 ? 'text-foreground/80' : 'text-muted-foreground'
                        }`}
                      >
                        {progressLabel}
                      </p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
