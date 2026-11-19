import React, { useMemo } from 'react';
import type { StudyStatistics } from '@/types/userStudy';
import PerformanceChart from '../charts/PerformanceChart';
import SubjectTimeDistributionChart from '../charts/SubjectTimeDistributionChart';
import AccuracyEvolutionChart from '../charts/AccuracyEvolutionChart';
import { QuestionPerformancePanel } from './QuestionPerformancePanel';
import { StatsSummaryCards } from './StatsSummaryCards';
import { getStatisticsForPeriod } from '../../domain/statisticsFilters';
import type { StatisticsTimeFilter } from '../../domain/types';

type StatisticsDashboardProps = {
  statistics: StudyStatistics;
  timeFilter: StatisticsTimeFilter;
  onTimeFilterChange: (filter: StatisticsTimeFilter) => void;
  filteredStats: {
    hours: number;
    sessions: number;
    average: number;
    questionsAnswered: number;
    correctAnswers: number;
  };
};

/** Painel reutilizável — page do aluno ou coach (read-only). */
export function StatisticsDashboard({
  statistics,
  timeFilter,
  onTimeFilterChange,
  filteredStats,
}: StatisticsDashboardProps) {
  const periodStatistics = useMemo(
    () => getStatisticsForPeriod(statistics, timeFilter),
    [statistics, timeFilter]
  );

  return (
    <>
      <StatsSummaryCards
        statistics={statistics}
        filteredStats={filteredStats}
        timeFilter={timeFilter}
      />

      <div className="mb-6">
        <PerformanceChart
          statistics={periodStatistics}
          timeFilter={timeFilter}
          onTimeFilterChange={onTimeFilterChange}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-6">
        <SubjectTimeDistributionChart statistics={periodStatistics} />
        <QuestionPerformancePanel statistics={periodStatistics} timeFilter={timeFilter} />
        <AccuracyEvolutionChart statistics={periodStatistics} />
      </div>
    </>
  );
}
