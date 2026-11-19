const STORAGE_KEY = 'convoca-pending-timer-task';

export type PendingTimerTask = {
  scheduleSessionId: string;
  disciplineName: string;
  blockName?: string;
  cycleId: string;
  dayOfWeek: number;
  returnPath: string;
  plannedDurationMinutes?: number;
  /** Dono dos dados (aluno); no modo coach difere do usuário logado */
  ownerUserId?: string;
};

export function setPendingTimerTask(task: PendingTimerTask): void {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(task));
}

export function getPendingTimerTask(): PendingTimerTask | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PendingTimerTask;
  } catch {
    return null;
  }
}

export function clearPendingTimerTask(): void {
  sessionStorage.removeItem(STORAGE_KEY);
}

const SUGGESTED_MINUTES_KEY = 'convoca-timer-suggested-minutes';

/** Minutos do timer para pré-preencher o modal da tarefa (não persiste estatísticas). */
export function setTimerSuggestedMinutes(scheduleSessionId: string, minutes: number): void {
  sessionStorage.setItem(
    SUGGESTED_MINUTES_KEY,
    JSON.stringify({ scheduleSessionId, minutes })
  );
}

export function consumeTimerSuggestedMinutes(scheduleSessionId: string): number | null {
  try {
    const raw = sessionStorage.getItem(SUGGESTED_MINUTES_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { scheduleSessionId: string; minutes: number };
    if (parsed.scheduleSessionId !== scheduleSessionId) return null;
    sessionStorage.removeItem(SUGGESTED_MINUTES_KEY);
    return parsed.minutes;
  } catch {
    return null;
  }
}
