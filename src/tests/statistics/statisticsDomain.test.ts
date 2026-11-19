import { describe, it, expect } from 'vitest';
import {
  formatStatisticsPercentage,
  formatStudyHours,
  getStatisticsPeriodLabel,
  getStatisticsPeriodShortLabel,
} from '@/modules/statistics/domain/statisticsFormatters';
import { getStatisticsForPeriod, toLocalDateKey } from '@/modules/statistics/domain/statisticsFilters';

describe('statisticsFormatters', () => {
  it('formats hours and percentages', () => {
    expect(formatStudyHours(12.345)).toBe('12.3h');
    expect(formatStatisticsPercentage(25, 100)).toBe('25.0%');
    expect(formatStatisticsPercentage(1, 0)).toBe('0%');
  });

  it('returns period labels', () => {
    expect(getStatisticsPeriodLabel('week')).toBe('7 dias');
    expect(getStatisticsPeriodShortLabel('month')).toBe('30 dias');
  });
});

describe('statisticsFilters', () => {
  it('parses local date keys', () => {
    expect(toLocalDateKey('2024-05-01T15:00:00Z')).toMatch(/^2024-05-0/);
  });

  it('filters statistics for period', () => {
    const stats = getStatisticsForPeriod(
      {
        totalHours: 10,
        totalSessions: 5,
        questionsAnswered: 20,
        correctAnswers: 15,
        wrongAnswers: 5,
        sessionHistory: [
          {
            date: new Date().toISOString(),
            duration: 60,
            questions: 10,
            correctAnswers: 8,
            subject: 'Direito',
            type: 'manual',
          },
        ],
        subjectStats: {},
        averages: { dailyHours: 0, weeklyHours: 0, monthlyHours: 0 },
      },
      'week'
    );

    expect(stats.totalSessions).toBe(1);
    expect(stats.questionsAnswered).toBe(10);
  });
});
