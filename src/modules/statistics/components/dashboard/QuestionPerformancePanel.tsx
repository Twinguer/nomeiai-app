import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckCircle } from 'lucide-react';
import type { StudyStatistics } from '@/types/userStudy';
import { formatStatisticsPercentage, getStatisticsPeriodLabel } from '../../domain/statisticsFormatters';
import type { StatisticsTimeFilter } from '../../domain/types';

type QuestionPerformancePanelProps = {
  statistics: StudyStatistics;
  timeFilter: StatisticsTimeFilter;
};

export function QuestionPerformancePanel({ statistics, timeFilter }: QuestionPerformancePanelProps) {
  const periodLabel = getStatisticsPeriodLabel(timeFilter);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-success" />
          Desempenho em Questões
        </CardTitle>
        <CardDescription>No período: {periodLabel}</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="geral" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="geral">Geral</TabsTrigger>
            <TabsTrigger value="disciplinas">Por Disciplina</TabsTrigger>
          </TabsList>

          <TabsContent value="geral" className="mt-4">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Total Respondidas</span>
                <Badge variant="secondary">{statistics.questionsAnswered}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-success">Acertos</span>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="bg-success/10 text-success">
                    {statistics.correctAnswers}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    (
                    {formatStatisticsPercentage(
                      statistics.correctAnswers,
                      statistics.questionsAnswered
                    )}
                    )
                  </span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-destructive">Erros</span>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="bg-destructive/10 text-destructive">
                    {statistics.wrongAnswers}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    (
                    {formatStatisticsPercentage(statistics.wrongAnswers, statistics.questionsAnswered)}
                    )
                  </span>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="disciplinas" className="mt-4">
            {Object.keys(statistics.subjectStats).length > 0 ? (
              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {Object.entries(statistics.subjectStats).map(([subject, stats]) => (
                  <div key={subject} className="p-3 border rounded-lg">
                    <h4 className="font-medium text-sm mb-2">{subject}</h4>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="text-center">
                        <div className="font-semibold text-foreground">{stats.questionsAnswered}</div>
                        <div className="text-muted-foreground">Total</div>
                      </div>
                      <div className="text-center">
                        <div className="font-semibold text-success">{stats.correctAnswers}</div>
                        <div className="text-muted-foreground">Acertos</div>
                      </div>
                      <div className="text-center">
                        <div className="font-semibold text-destructive">{stats.wrongAnswers}</div>
                        <div className="text-muted-foreground">Erros</div>
                      </div>
                    </div>
                    {stats.questionsAnswered > 0 && (
                      <div className="mt-2">
                        <div className="w-full bg-secondary rounded-full h-1.5">
                          <div
                            className="bg-success h-1.5 rounded-full transition-all duration-300"
                            style={{
                              width: `${(stats.correctAnswers / stats.questionsAnswered) * 100}%`,
                            }}
                          />
                        </div>
                        <div className="text-xs text-muted-foreground mt-1 text-center">
                          {formatStatisticsPercentage(stats.correctAnswers, stats.questionsAnswered)}{' '}
                          de acerto
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <CheckCircle className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  Nenhuma questão por disciplina registrada ainda
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Use o rastreamento de questões para ver estatísticas por disciplina
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
