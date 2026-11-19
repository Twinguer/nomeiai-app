import type { DragEndEvent } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { toUiDayOfWeek } from '../domain/scheduleMode';

export const sessionSortId = (id: string) => `session:${id}`;
export const dayDropId = (day: number) => `day:${day}`;

export type WeeklyTaskDragItem = {
  id: string;
  cycleId: string;
  day: number;
  displayOrder?: number;
};

export function parseSessionSortId(id: string): string | null {
  const prefix = 'session:';
  return String(id).startsWith(prefix) ? String(id).slice(prefix.length) : null;
}

export function parseDayDropId(id: string): number | null {
  const prefix = 'day:';
  if (!String(id).startsWith(prefix)) return null;
  const n = Number(String(id).slice(prefix.length));
  return Number.isFinite(n) ? n : null;
}

/** Reordena tarefas modo tempo do mesmo ciclo; retorna mapa id -> { day, displayOrder } */
export function applyWeeklyScheduleDragEnd(
  event: DragEndEvent,
  tasks: WeeklyTaskDragItem[],
  cycleId: string
): Map<string, { day: number; displayOrder: number }> | null {
  const { active, over } = event;
  if (!over || active.id === over.id) return null;

  const activeId = parseSessionSortId(String(active.id));
  if (!activeId) return null;

  const activeTask = tasks.find((t) => t.id === activeId && t.cycleId === cycleId);
  if (!activeTask) return null;

  let targetDay = activeTask.day;
  let targetIndex: number;

  let overDay = parseDayDropId(String(over.id));
  if (overDay === null && over.data.current?.type === 'day') {
    overDay = Number(over.data.current.day);
    if (!Number.isFinite(overDay)) overDay = null;
  }

  let overSessionId = parseSessionSortId(String(over.id));
  if (!overSessionId && over.data.current?.type === 'task') {
    overSessionId = String(over.data.current.sessionId ?? '');
    if (!overSessionId) overSessionId = null;
  }

  const cycleTasks = tasks
    .filter((t) => t.cycleId === cycleId)
    .sort((a, b) => {
      if (a.day !== b.day) return a.day - b.day;
      return (a.displayOrder ?? 0) - (b.displayOrder ?? 0);
    });

  const byDay = (day: number) =>
    cycleTasks.filter((t) => t.day === day).sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));

  if (overDay !== null) {
    targetDay = overDay;
    targetIndex = byDay(targetDay).length;
  } else if (overSessionId) {
    const overTask = cycleTasks.find((t) => t.id === overSessionId);
    if (!overTask || overTask.cycleId !== cycleId) return null;
    targetDay = overTask.day;
    const dayList = byDay(targetDay);
    targetIndex = dayList.findIndex((t) => t.id === overSessionId);
    if (targetIndex === -1) targetIndex = dayList.length;
  } else {
    return null;
  }

  const fromDay = activeTask.day;
  const fromList = byDay(fromDay);
  const fromIndex = fromList.findIndex((t) => t.id === activeId);
  if (fromIndex === -1) return null;

  let newFromList = fromList;
  let newTargetList = byDay(targetDay);

  if (fromDay === targetDay) {
    newTargetList = arrayMove(fromList, fromIndex, targetIndex);
  } else {
    newFromList = fromList.filter((t) => t.id !== activeId);
    newTargetList = [...byDay(targetDay)];
    newTargetList.splice(targetIndex, 0, { ...activeTask, day: targetDay });
  }

  const updates = new Map<string, { day: number; displayOrder: number }>();

  newFromList.forEach((t, i) => {
    updates.set(t.id, { day: fromDay, displayOrder: i });
  });
  newTargetList.forEach((t, i) => {
    updates.set(t.id, { day: targetDay, displayOrder: i });
  });

  return updates;
}

export function studyScheduleDayToUi(dayOfWeek: number): number {
  return toUiDayOfWeek(dayOfWeek);
}
