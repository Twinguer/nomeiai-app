import type { StatisticsTimeFilter } from './types';

export function formatStudyHours(hours: number): string {
  return `${hours.toFixed(1)}h`;
}

export function formatStatisticsPercentage(value: number, total: number): string {
  if (total === 0) return '0%';
  return `${((value / total) * 100).toFixed(1)}%`;
}

export function getStatisticsPeriodLabel(filter: StatisticsTimeFilter): string {
  if (filter === 'day') return 'hoje';
  if (filter === 'week') return '7 dias';
  return '30 dias';
}

export function getStatisticsPeriodShortLabel(filter: StatisticsTimeFilter): string {
  if (filter === 'day') return '1 dia';
  if (filter === 'week') return '7 dias';
  return '30 dias';
}
