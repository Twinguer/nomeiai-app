import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3, Clock, Target, TrendingUp } from 'lucide-react';
import type { StudyStatistics } from '@/types/userStudy';
import {
  formatStatisticsPercentage,
  formatStudyHours,
  getStatisticsPeriodShortLabel,
} from '../../domain/statisticsFormatters';
import type { StatisticsTimeFilter } from '../../domain/types';

type StatsSummaryCardsProps = {
  statistics: StudyStatistics;
  filteredStats: {
    hours: number;
    sessions: number;
    average: number;
    questionsAnswered: number;
    correctAnswers: number;
  };
  timeFilter: StatisticsTimeFilter;
};

export function StatsSummaryCards({ statistics, filteredStats, timeFilter }: StatsSummaryCardsProps) {
  const periodShortLabel = getStatisticsPeriodShortLabel(timeFilter);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2 mb-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total de Horas</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatStudyHours(statistics.totalHours)}</div>
          <p className="text-xs text-muted-foreground">
            {formatStudyHours(filteredStats.hours)} nos últimos {periodShortLabel}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Média {timeFilter === 'day' ? 'Diária' : timeFilter === 'week' ? 'Semanal' : 'Mensal'}
          </CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatStudyHours(filteredStats.average)}</div>
          <p className="text-xs text-muted-foreground">Baseado nos últimos {periodShortLabel}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Tarefas</CardTitle>
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{statistics.totalSessions}</div>
          <p className="text-xs text-muted-foreground">
            {filteredStats.sessions} nos últimos {periodShortLabel}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total de Questões</CardTitle>
          <Target className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="text-2xl font-bold">{statistics.questionsAnswered}</div>
          <div className="flex flex-col gap-1 text-xs">
            <span className="text-success font-medium">
              {statistics.correctAnswers} acertos ·{' '}
              {formatStatisticsPercentage(statistics.correctAnswers, statistics.questionsAnswered)}
            </span>
            <span className="text-destructive font-medium">
              {statistics.wrongAnswers} erros ·{' '}
              {formatStatisticsPercentage(statistics.wrongAnswers, statistics.questionsAnswered)}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {filteredStats.questionsAnswered} nos últimos {periodShortLabel}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
