import React from 'react';
import { Button } from '@/components/ui/button';
import { Timer, Trash2, ExternalLink, Pencil } from 'lucide-react';
import type { WeeklyScheduleSession } from './weeklyScheduleTypes';
import { formatTaskDurationHours } from '../domain/disciplineStudyStats';

type SessionDataEntry = {
  duration_minutes?: number;
  questions?: number;
  correct_answers?: number;
  session_count?: number;
  cycle_name?: string;
  session_link?: string;
};

interface WeeklyScheduleTaskCardProps {
  session: WeeklyScheduleSession;
  sessionData?: SessionDataEntry;
  dragHandle: React.ReactNode;
  onEdit: () => void;
  onEditPlan: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
}

export function WeeklyScheduleTaskCard({
  session,
  sessionData: cumulativeSession,
  dragHandle,
  onEdit,
  onEditPlan,
  onDelete,
}: WeeklyScheduleTaskCardProps) {
  const hasData =
    cumulativeSession &&
    ((cumulativeSession.duration_minutes ?? 0) > 0 || (cumulativeSession.questions ?? 0) > 0);
  const accuracy =
    cumulativeSession && (cumulativeSession.questions ?? 0) > 0
      ? Math.round(
          ((cumulativeSession.correct_answers ?? 0) / (cumulativeSession.questions ?? 1)) * 100
        )
      : 0;
  const sessionCount = cumulativeSession?.session_count || 1;

  return (
    <div
      className={`p-3 rounded-lg border relative cursor-pointer transition-all duration-300 min-h-[180px] ${
        hasData
          ? 'border-primary/20 bg-primary/5 hover:bg-primary/10'
          : 'border-muted bg-muted/30 hover:bg-muted/50'
      } rounded-xl shadow-lg hover:shadow-2xl overflow-hidden`}
      style={{
        boxShadow:
          '0 8px 25px rgba(0, 0, 0, 0.15), 0 4px 10px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.05)',
      }}
      onClick={onEdit}
    >
      <div className="space-y-3 h-full flex flex-col">
        <div className="flex justify-between items-center gap-1">
          <div className="flex items-center gap-1 text-sm font-medium text-muted-foreground min-w-0">
            {dragHandle}
            {session.durationMinutes ? (
              <span className="flex items-center gap-1">
                <Timer className="h-3 w-3 shrink-0" />
                {session.durationMinutes}min
              </span>
            ) : session.startTime && session.endTime ? (
              `${session.startTime.substring(0, 5)} - ${session.endTime.substring(0, 5)}`
            ) : (
              'Horário livre'
            )}
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            <div
              className="cursor-pointer transition-colors p-1 rounded hover:bg-primary/10"
              onClick={onEditPlan}
              title="Editar tarefa"
            >
              <Pencil className="h-4 w-4 text-muted-foreground hover:text-primary transition-colors" />
            </div>
            <div
              className="cursor-pointer transition-colors p-1 rounded hover:bg-destructive/10"
              onClick={onDelete}
              title="Remover tarefa"
            >
              <Trash2 className="h-4 w-4 text-destructive/70 hover:text-destructive transition-colors" />
            </div>
          </div>
        </div>

        <div className="space-y-1 flex-1">
          <h4 className="font-medium text-sm text-foreground leading-tight">{session.disciplineName}</h4>
          <p className="text-xs text-muted-foreground">{session.blockName}</p>
          {cumulativeSession?.cycle_name && cumulativeSession.cycle_name !== 'Ciclo desconhecido' && (
            <p className="text-xs text-primary font-medium">Ciclo: {cumulativeSession.cycle_name}</p>
          )}
        </div>

        {hasData && (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex justify-between items-center p-2 bg-background/50 rounded">
                <span className="text-muted-foreground">Tempo total:</span>
                <span className="font-medium text-foreground">
                  {formatTaskDurationHours(cumulativeSession!.duration_minutes ?? 0)}
                </span>
              </div>
              <div className="flex justify-between items-center p-2 bg-background/50 rounded">
                <span className="text-muted-foreground">Tarefas:</span>
                <span className="font-medium text-foreground">{sessionCount}</span>
              </div>
              <div className="flex justify-between items-center p-2 bg-background/50 rounded">
                <span className="text-muted-foreground">Questões:</span>
                <span className="font-medium text-foreground">{cumulativeSession!.questions}</span>
              </div>
              <div className="flex justify-between items-center p-2 bg-background/50 rounded">
                <span className="text-muted-foreground">Acertos:</span>
                <span className="font-medium text-foreground">{accuracy}%</span>
              </div>
            </div>
          </div>
        )}

        {(session.sessionLink || cumulativeSession?.session_link) && (
          <div className="pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                const linkToOpen = cumulativeSession?.session_link || session.sessionLink;
                if (linkToOpen) window.open(linkToOpen, '_blank');
              }}
              className="w-full text-xs"
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              Ir à aula
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
