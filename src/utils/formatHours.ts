/**
 * Formata horas decimais para exibição (ex.: 183.08 → "183.1h")
 */
export function formatHoursDisplay(hours: number): string {
  if (!hours || hours <= 0) return '0h';
  return `${hours.toFixed(1)}h`;
}
