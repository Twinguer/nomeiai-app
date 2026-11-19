/**
 * Interpreta YYYY-MM-DD (ou ISO) como data no fuso local (evita deslocar um dia no Brasil).
 */
export function parseLocalDate(dateStr: string): Date {
  const trimmed = dateStr.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }
  return new Date(trimmed);
}

/** Início do domingo da semana atual (horário local). */
export function getStartOfCurrentWeek(): Date {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - now.getDay());
  start.setHours(0, 0, 0, 0);
  return start;
}

/** Início do período dos últimos 7 dias corridos (hoje + 6 dias anteriores, meia-noite local). */
export function getStartOfLast7Days(): Date {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - 6);
  return start;
}

export function isDateOnOrAfter(dateStr: string, periodStart: Date): boolean {
  if (!dateStr) return false;
  const d = parseLocalDate(dateStr.split('T')[0]);
  return !Number.isNaN(d.getTime()) && d >= periodStart;
}

/** @deprecated Use isDateOnOrAfter */
export function isDateOnOrAfterWeekStart(dateStr: string, weekStart: Date): boolean {
  return isDateOnOrAfter(dateStr, weekStart);
}

/** Ex.: "2026-05-18" → "18/05/2026" */
export function formatLocalDatePtBr(dateStr: string): string {
  const d = parseLocalDate(dateStr.split('T')[0]);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}
