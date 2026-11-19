import React, { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StudyStatistics } from '@/types/userStudy';
import { toLocalDateKey } from '../../domain/statisticsFilters';

interface AccuracyEvolutionChartProps {
  statistics: StudyStatistics;
}

type DailyAgg = {
  date: string;
  fullDate: string;
  accuracy: number;
  questions: number;
  correct: number;
  wrong: number;
  hours: number;
};

const AccuracyEvolutionChart: React.FC<AccuracyEvolutionChartProps> = ({ statistics }) => {
  const chartData = useMemo((): DailyAgg[] => {
    const sessionHistory = statistics.sessionHistory || [];
    const dailyData: Record<string, { correct: number; total: number; minutes: number }> = {};

    sessionHistory.forEach((session) => {
      const dateKey = toLocalDateKey(session.date);
      if (!dateKey) return;

      if (!dailyData[dateKey]) {
        dailyData[dateKey] = { correct: 0, total: 0, minutes: 0 };
      }

      const q = session.questions ?? 0;
      const c = session.correctAnswers ?? 0;
      dailyData[dateKey].correct += c;
      dailyData[dateKey].total += q;
      dailyData[dateKey].minutes += session.duration ?? 0;
    });

    return Object.entries(dailyData)
      .map(([dateKey, data]) => ({
        date: new Date(`${dateKey}T12:00:00`).toLocaleDateString('pt-BR', {
          month: 'short',
          day: 'numeric',
        }),
        fullDate: dateKey,
        accuracy: data.total > 0 ? (data.correct / data.total) * 100 : 0,
        questions: data.total,
        correct: data.correct,
        wrong: Math.max(0, data.total - data.correct),
        hours: data.minutes / 60,
      }))
      .sort((a, b) => new Date(a.fullDate).getTime() - new Date(b.fullDate).getTime());
  }, [statistics.sessionHistory]);

  const formatPercentage = (value: number) => `${value.toFixed(1)}%`;

  const formatHours = (hours: number) => {
    if (hours < 1) {
      return `${Math.round(hours * 60)}min`;
    }
    return `${hours.toFixed(1)}h`;
  };

  const CustomTooltip = ({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: Array<{ payload: DailyAgg }>;
  }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium text-foreground mb-2">{data.fullDate}</p>
          <div className="space-y-1 text-sm">
            <p className="text-muted-foreground">
              Taxa de acerto:{' '}
              <span className="text-foreground font-medium">{formatPercentage(data.accuracy)}</span>
            </p>
            <p className="text-muted-foreground">
              Questões: <span className="text-foreground font-medium">{data.questions}</span>
            </p>
            <p className="text-muted-foreground">
              <span className="text-success font-medium">{data.correct}</span> acertos
              <span className="text-muted-foreground"> / </span>
              <span className="text-destructive font-medium">{data.wrong}</span> erros
            </p>
            <p className="text-muted-foreground">
              Tempo: <span className="text-foreground font-medium">{formatHours(data.hours)}</span>
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  const CustomLegend = ({ payload }: { payload?: Array<{ value: string; color: string }> }) => {
    if (!payload || payload.length === 0) return null;

    return (
      <div className="flex justify-center gap-4 mt-4">
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <div className="w-3 h-0.5" style={{ backgroundColor: entry.color }} />
            <span className="text-muted-foreground">{entry.value}</span>
          </div>
        ))}
      </div>
    );
  };

  const totalQuestions = chartData.reduce((sum, item) => sum + item.questions, 0);
  const totalCorrect = chartData.reduce((sum, item) => sum + item.correct, 0);
  const averageAccuracy = totalQuestions > 0 ? (totalCorrect / totalQuestions) * 100 : 0;
  const totalHours = chartData.reduce((sum, item) => sum + item.hours, 0);

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">📈 Evolução da Taxa de Acerto</CardTitle>
          <CardDescription>Acompanhe sua evolução ao longo do tempo</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="text-4xl mb-2">📊</div>
            <p className="text-sm text-muted-foreground">Nenhum dado de evolução disponível</p>
            <p className="text-xs text-muted-foreground mt-1">
              Continue estudando para ver sua evolução
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">📈 Evolução da Taxa de Acerto</CardTitle>
        <CardDescription>Dados reais das sessões registradas no período exibido</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                domain={[0, 100]}
                tickFormatter={(value) => `${value}%`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend content={<CustomLegend />} />
              <Line
                type="monotone"
                dataKey="accuracy"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, stroke: 'hsl(var(--primary))', strokeWidth: 2 }}
                name="Taxa de Acerto"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-4 p-3 bg-muted/50 rounded-lg">
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">Dias com dados:</span>
              <span className="font-medium text-foreground">{chartData.length}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">Média:</span>
              <span className="font-medium text-foreground">{formatPercentage(averageAccuracy)}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">Questões:</span>
              <span className="font-medium text-foreground">{totalQuestions}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">Tempo:</span>
              <span className="font-medium text-foreground">{formatHours(totalHours)}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AccuracyEvolutionChart;

