import React from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  pointerWithin,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import type { StudyCycleV2, StudySchedule } from '@/types/userStudy';
import {
  applyWeeklyScheduleDragEnd,
  dayDropId,
  parseSessionSortId,
  sessionSortId,
  type WeeklyTaskDragItem,
} from './weeklyScheduleDnd';
import { canReorderSession, getCycleScheduleMode } from '../domain/scheduleMode';

export type WeeklyBoardSession = WeeklyTaskDragItem & {
  startTime?: string;
  endTime?: string;
  durationMinutes?: number;
};

/** Prioriza card sob o ponteiro; senão coluna do dia; senão centro mais próximo */
const scheduleCollisionDetection: CollisionDetection = (args) => {
  const pointerHits = pointerWithin(args);
  if (pointerHits.length > 0) {
    const sessionHit = pointerHits.find((c) => String(c.id).startsWith('session:'));
    if (sessionHit) return [sessionHit];
    const dayHit = pointerHits.find((c) => String(c.id).startsWith('day:'));
    if (dayHit) return [dayHit];
    return pointerHits;
  }
  return closestCenter(args);
};

function DragHandle(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className="touch-none cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground p-0 border-0 bg-transparent flex-shrink-0"
      aria-label="Arrastar para reordenar"
      onClick={(e) => e.stopPropagation()}
      {...props}
    >
      <GripVertical className="h-4 w-4" />
    </button>
  );
}

function DraggableTaskShell({
  session,
  canDrag,
  children,
}: {
  session: WeeklyBoardSession;
  canDrag: boolean;
  children: (opts: {
    dragHandle: React.ReactNode;
    setNodeRef: (node: HTMLElement | null) => void;
    style: React.CSSProperties | undefined;
    isDragging: boolean;
  }) => React.ReactNode;
}) {
  const sortId = sessionSortId(session.id);

  const { attributes, listeners, setNodeRef: setDragRef, transform, isDragging } = useDraggable({
    id: sortId,
    data: { type: 'task', sessionId: session.id, cycleId: session.cycleId, day: session.day },
    disabled: !canDrag,
  });

  const { setNodeRef: setDropRef } = useDroppable({
    id: sortId,
    data: { type: 'task', sessionId: session.id, cycleId: session.cycleId, day: session.day },
    disabled: !canDrag,
  });

  const setNodeRef = React.useCallback(
    (node: HTMLElement | null) => {
      setDragRef(node);
      setDropRef(node);
    },
    [setDragRef, setDropRef]
  );

  const style =
    canDrag && transform
      ? {
          transform: CSS.Translate.toString(transform),
          zIndex: isDragging ? 50 : undefined,
        }
      : undefined;

  const dragHandle = canDrag ? <DragHandle {...attributes} {...listeners} /> : null;

  return (
    <>
      {children({
        dragHandle,
        setNodeRef: canDrag ? setNodeRef : () => {},
        style,
        isDragging,
      })}
    </>
  );
}

function DayColumn({
  dayIndex,
  dayLabel,
  children,
}: {
  dayIndex: number;
  dayLabel: string;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: dayDropId(dayIndex),
    data: { type: 'day', day: dayIndex },
  });

  return (
    <div className="space-y-2 min-h-0">
      <h3 className="font-medium text-center p-2 bg-muted rounded-md text-sm">{dayLabel}</h3>
      <div
        ref={setNodeRef}
        className={`space-y-2 min-h-[250px] rounded-md p-1 transition-colors ${
          isOver ? 'bg-primary/10 ring-2 ring-primary/30' : 'bg-transparent'
        }`}
      >
        {children}
      </div>
    </div>
  );
}

export interface WeeklyScheduleBoardProps<T extends WeeklyBoardSession> {
  weekDays: string[];
  sessions: T[];
  cycles: StudyCycleV2[];
  scheduleByCycleId: Record<string, StudySchedule[]>;
  onReorder: (updates: Map<string, { day: number; displayOrder: number }>, cycleId: string) => void;
  renderCard: (
    session: T,
    ctx: { canDrag: boolean; dragHandle: React.ReactNode; onCardClick: () => void }
  ) => React.ReactNode;
  onCardClick: (session: T) => void;
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
}

export function WeeklyScheduleBoard<T extends WeeklyBoardSession>({
  weekDays,
  sessions,
  cycles,
  scheduleByCycleId,
  onReorder,
  renderCard,
  onCardClick,
  loading,
  error,
  onRetry,
}: WeeklyScheduleBoardProps<T>) {
  const [activeDragSession, setActiveDragSession] = React.useState<T | null>(null);
  const lastOverRef = React.useRef<DragEndEvent['over']>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor)
  );

  const hasDurationCycle = cycles.some(
    (c) => getCycleScheduleMode(c, scheduleByCycleId[c.id] || []) === 'duration'
  );

  const getSessionsForDay = (day: number) => {
    const daySessions = sessions.filter((s) => s.day === day);
    return [...daySessions].sort((a, b) => {
      const modeA = getCycleScheduleMode(
        cycles.find((c) => c.id === a.cycleId),
        scheduleByCycleId[a.cycleId] || []
      );
      if (a.cycleId !== b.cycleId) return a.cycleId.localeCompare(b.cycleId);
      if (modeA === 'duration') {
        return (a.displayOrder ?? 0) - (b.displayOrder ?? 0);
      }
      if (a.startTime && b.startTime) return a.startTime.localeCompare(b.startTime);
      if (a.startTime && !b.startTime) return -1;
      if (!a.startTime && b.startTime) return 1;
      return (a.durationMinutes || 0) - (b.durationMinutes || 0);
    });
  };

  const handleDragStart = (event: DragStartEvent) => {
    const sessionId = parseSessionSortId(String(event.active.id));
    if (!sessionId) return;
    const session = sessions.find((s) => s.id === sessionId);
    if (session) setActiveDragSession(session);
  };

  const handleDragOver = (event: DragOverEvent) => {
    if (event.over) lastOverRef.current = event.over;
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragSession(null);
    const { active } = event;
    const over = event.over ?? lastOverRef.current;
    lastOverRef.current = null;
    if (!over) return;

    const activeCycleId = active.data.current?.cycleId as string | undefined;
    if (!activeCycleId) return;

    const mode = getCycleScheduleMode(
      cycles.find((c) => c.id === activeCycleId),
      scheduleByCycleId[activeCycleId] || []
    );
    if (mode !== 'duration') return;

    const tasks: WeeklyTaskDragItem[] = sessions.map((s) => ({
      id: s.id,
      cycleId: s.cycleId,
      day: s.day,
      displayOrder: s.displayOrder,
    }));

    const updates = applyWeeklyScheduleDragEnd({ ...event, over }, tasks, activeCycleId);
    if (updates && updates.size > 0) {
      onReorder(updates, activeCycleId);
    }
  };

  const handleDragCancel = () => {
    setActiveDragSession(null);
    lastOverRef.current = null;
  };

  return (
    <>
      {hasDurationCycle && (
        <p className="text-xs text-muted-foreground mb-3">
          Arraste pelo ícone ⋮⋮ para mover entre dias ou reordenar (modo tempo de estudos). Horário fixo
          não permite reorganizar.
        </p>
      )}
      <DndContext
        sensors={sensors}
        collisionDetection={scheduleCollisionDetection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-4">
          {weekDays.map((dayLabel, dayIndex) => (
            <DayColumn key={dayIndex} dayIndex={dayIndex} dayLabel={dayLabel}>
              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <p className="text-sm text-muted-foreground">Carregando...</p>
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center h-32 gap-2">
                  <p className="text-sm text-destructive">Erro ao carregar</p>
                  {onRetry && (
                    <button type="button" className="text-xs underline" onClick={onRetry}>
                      Tentar novamente
                    </button>
                  )}
                </div>
              ) : (
                getSessionsForDay(dayIndex).map((session) => {
                  const mode = getCycleScheduleMode(
                    cycles.find((c) => c.id === session.cycleId),
                    scheduleByCycleId[session.cycleId] || []
                  );
                  const canDrag = canReorderSession(mode, session.cycleId, session.cycleId);
                  const isSourceHidden = activeDragSession?.id === session.id;

                  return (
                    <DraggableTaskShell key={session.id} session={session} canDrag={canDrag}>
                      {({ dragHandle, setNodeRef, style }) => (
                        <div
                          ref={canDrag ? setNodeRef : undefined}
                          style={style}
                          className={isSourceHidden ? 'invisible' : undefined}
                        >
                          {renderCard(session, {
                            canDrag,
                            dragHandle,
                            onCardClick: () => onCardClick(session),
                          })}
                        </div>
                      )}
                    </DraggableTaskShell>
                  );
                })
              )}
            </DayColumn>
          ))}
        </div>

        <DragOverlay dropAnimation={null}>
          {activeDragSession ? (
            <div className="opacity-90 shadow-2xl pointer-events-none max-w-[280px]">
              {renderCard(activeDragSession, {
                canDrag: true,
                dragHandle: <GripVertical className="h-4 w-4 text-muted-foreground" />,
                onCardClick: () => {},
              })}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </>
  );
}
