/**
 * Módulo Study — API pública.
 */

export {
  getScheduleSessions,
  formatSessionForSchedule,
  groupSessionsByDay,
  getCycleScheduleByDay,
  sessionExistsInSchedule,
  getSessionById,
} from './domain/scheduleHelpers';

export {
  DEFAULT_SCHEDULE_MODE,
  toUiDayOfWeek,
  toStorageDayOfWeek,
  isTimeBasedSession,
  getCycleScheduleMode,
  canReorderSession,
  sortScheduleSessionsForDisplay,
  assignDisplayOrdersForCycle,
  type ScheduleMode,
} from './domain/scheduleMode';

/** @deprecated Import from `@/modules/statistics`. */
export {
  toLocalDateKey,
  getPeriodStartDate,
  getPeriodDayCount,
  isSessionInPeriod,
  filterSessionHistory,
  getStatisticsForPeriod,
  getFilteredPeriodSummary,
  type StudyTimeFilter,
} from '@/modules/statistics';

/** @deprecated Import from `@/modules/statistics`. */
export {
  sessionHistoryToStudySessions,
  resolveStudySessions,
  resolveStudyStatistics,
  resolveUserStudyStatisticsFromData,
} from '@/modules/statistics';

/** @deprecated Import from `@/modules/statistics`. */
export { useStudyStatistics } from '@/modules/statistics';

export {
  EMPTY_DISCIPLINE_STATS,
  resolveDisciplineStats,
  formatStudyDurationDisplay,
  formatTaskDurationHours,
  formatLastStudyDateDisplay,
  normalizeDisciplineKey,
  isDisciplineCompletedForProgress,
  isDisciplineInReview,
  isDisciplineEmAndamento,
  isDisciplineEmAndamentoEffective,
  isDisciplineNotStarted,
  hasDisciplineStudyStats,
  shouldAutoSetEmAndamento,
  syncDisciplineProgressFromStats,
  aggregateDisciplineStatsForCycle,
  formatStudyDuration,
  getAccuracyPercent,
  getAccuracyColorClass,
  mergeDisciplineStats,
  aggregateBlockStats,
  formatLastStudyDate,
  type DisciplineStudyStats,
  type DisciplineProgressStatus,
} from './domain/disciplineStudyStats';

export {
  buildAvailableDisciplinesFromBlocks,
  reorderArray,
  type StudyCycleBlockInput,
} from './domain/studyCycleSchedule';

export { MIRROR_WEEKLY_STATS } from './domain/studyWrite';

export {
  recordCompletedSessionForUser,
  type CompletedSessionInput,
  type RecordCompletedSessionResult,
} from './services/studySessionService';

export {
  useCronogramaData,
  mapScheduleToCronogramaSessions,
  type CronogramaStudySession,
  type UseCronogramaDataOptions,
} from './hooks/useCronogramaData';

export { useStudyProAccess } from './hooks/useStudyProAccess';
export { useSecureStudyCycleUrls } from './hooks/useSecureStudyCycleUrls';
export { useCycleDocuments, type CycleDocumentType } from './hooks/useCycleDocuments';
export {
  useStudyCyclesV2,
  type SessionData,
  type CompletedSession,
  type WeeklySchedule,
} from './hooks/useStudyCyclesV2';

export { default as StudyDashboard } from './pages/StudyDashboard';
export { default as CronogramaPage } from './pages/Cronograma';
export { default as TimerPage } from './pages/Timer';
export { default as CreateCyclePage } from './pages/CriarCiclo';
export { default as EditCyclePage } from './pages/EditarCiclo';
export { default as CycleDetailsPage } from './pages/CicloDetalhes';
export { default as SessionRedirectPage } from './pages/SessaoEstudos';
export type { CronogramaProps } from './pages/Cronograma';

export { EditalVerticalizado } from './components/EditalVerticalizado';
export type { EditalBlock, EditalDiscipline } from './components/editalTypes';
export { SortableBlocksList } from './components/SortableBlocksList';
