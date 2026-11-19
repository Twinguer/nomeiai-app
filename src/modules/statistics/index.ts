export * from './domain/types';
export * from './domain/statisticsFormatters';
export * from './domain/statisticsFilters';
export * from './domain/statisticsMerge';

export { statisticsService } from './services/statisticsService';
export { useStudyStatistics } from './hooks/useStudyStatistics';

export { StatisticsLoadingState } from './components/shared/StatisticsLoadingState';
export { StatisticsPageHeader } from './components/dashboard/StatisticsPageHeader';
export { StatsSummaryCards } from './components/dashboard/StatsSummaryCards';
export { QuestionPerformancePanel } from './components/dashboard/QuestionPerformancePanel';
export { StatisticsDashboard } from './components/dashboard/StatisticsDashboard';

export { default as PerformanceChart } from './components/charts/PerformanceChart';
export { default as SubjectTimeDistributionChart } from './components/charts/SubjectTimeDistributionChart';
export { default as AccuracyEvolutionChart } from './components/charts/AccuracyEvolutionChart';
export { default as StudyHeatmapChart } from './components/charts/StudyHeatmapChart';

export { default as StatisticsPage } from './pages/StatisticsPage';
