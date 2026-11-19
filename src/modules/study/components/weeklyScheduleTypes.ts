export interface WeeklyScheduleSession {
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
