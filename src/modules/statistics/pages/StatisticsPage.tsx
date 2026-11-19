import React, { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { StatisticsDashboard } from '../components/dashboard/StatisticsDashboard';
import { StatisticsPageHeader } from '../components/dashboard/StatisticsPageHeader';
import { StatisticsLoadingState } from '../components/shared/StatisticsLoadingState';
import type { StatisticsTimeFilter } from '../domain/types';
import { useStudyStatistics } from '../hooks/useStudyStatistics';

const StatisticsPage = () => {
  const { statistics, isLoading, resetStatistics, getFilteredStats, refreshStatistics } =
    useStudyStatistics();
  const { toast } = useToast();
  const [timeFilter, setTimeFilter] = useState<StatisticsTimeFilter>('week');

  useEffect(() => {
    refreshStatistics();
  }, [refreshStatistics]);

  const filteredStats = getFilteredStats(timeFilter);

  const handleResetStats = async () => {
    await resetStatistics();
    toast({
      title: 'Estatísticas zeradas',
      description: 'Todas as suas estatísticas foram resetadas com sucesso.',
    });
  };

  if (isLoading) {
    return <StatisticsLoadingState />;
  }

  return (
    <div className="min-h-screen p-6">
      <StatisticsPageHeader
        timeFilter={timeFilter}
        onTimeFilterChange={setTimeFilter}
        onReset={handleResetStats}
      />
      <StatisticsDashboard
        statistics={statistics}
        timeFilter={timeFilter}
        onTimeFilterChange={setTimeFilter}
        filteredStats={filteredStats}
      />
    </div>
  );
};

export default StatisticsPage;
