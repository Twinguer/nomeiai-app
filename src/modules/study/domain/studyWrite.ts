/**
 * Controle de escrita durante migração study_schedule / weekly_schedule.
 *
 * VITE_MIRROR_WEEKLY_STATS=true → espelha total_stats em weekly_schedule (compatibilidade).
 * Omitido ou false → escrita unificada (só study_schedule + ledger).
 */
export const MIRROR_WEEKLY_STATS =
  import.meta.env.VITE_MIRROR_WEEKLY_STATS === 'true';
