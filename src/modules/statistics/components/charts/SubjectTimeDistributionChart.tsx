import React, { useMemo } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StudyStatistics } from '@/types/userStudy';

/** Acima disso, pizza fica ilegível — usamos barras horizontais. */
const PIE_MAX_CATEGORIES = 8;

const truncateLabel = (name: string, max = 28) =>
  name.length > max ? `${name.slice(0, max - 1)}…` : name;

interface SubjectTimeDistributionChartProps {
  statistics: StudyStatistics;
}

type ChartRow = {
  name: string;
  short: string;
  value: number;
  sessions: number;
  questions: number;
  correctAnswers: number;
  wrongAnswers: number;
};

type TooltipPayloadEntry = { payload: ChartRow };
type LegendPayloadEntry = { value: string; color: string; payload: ChartRow };

const COLORS = [
  'hsl(var(--primary))',
  '#3B82F6',
  '#1D4ED8',
  '#1E40AF',
  '#1E3A8A',
  '#60A5FA',
  '#93C5FD',
  '#DBEAFE',
  '#2563EB',
  '#1E90FF',
  '#4169E1',
  '#0000CD',
];

const SubjectTimeDistributionChart: React.FC<SubjectTimeDistributionChartProps> = ({
  statistics,
}) => {
  const chartData = useMemo((): ChartRow[] => {
    return Object.entries(statistics.subjectStats)
      .map(([subject, stats]) => ({
        name: subject,
        short: truncateLabel(subject, 26),
        value: stats.totalHours,
        sessions: stats.totalSessions,
        questions: stats.questionsAnswered,
        correctAnswers: stats.correctAnswers,
        wrongAnswers: stats.wrongAnswers,
      }))
      .sort((a, b) => b.value - a.value);
  }, [statistics.subjectStats]);

  const totalHours = chartData.reduce((sum, item) => sum + item.value, 0);
  const useBarLayout = chartData.length > PIE_MAX_CATEGORIES;

  const formatHours = (hours: number) => {
    if (hours < 1) {
      return `${Math.round(hours * 60)}min`;
    }
    return `${hours.toFixed(1)}h`;
  };

  const formatPercentage = (value: number) => {
    if (totalHours === 0) return '0%';
    return `${((value / totalHours) * 100).toFixed(1)}%`;
  };

  const CustomTooltip = ({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: TooltipPayloadEntry[];
  }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-background border border-border rounded-lg p-3 shadow-lg max-w-xs">
          <p className="font-medium text-foreground break-words">{data.name}</p>
          <div className="space-y-1 text-sm">
            <p className="text-muted-foreground">
              <span className="text-foreground font-medium">{formatHours(data.value)}</span> de
              estudo
            </p>
            <p className="text-muted-foreground">
              <span className="text-foreground font-medium">{data.sessions}</span> sessões
            </p>
            <p className="text-muted-foreground">
              <span className="text-foreground font-medium">{data.questions}</span> questões
            </p>
            {data.questions > 0 && (
              <p className="text-muted-foreground">
                <span className="text-success font-medium">{data.correctAnswers}</span> acertos
                <span className="text-muted-foreground"> / </span>
                <span className="text-destructive font-medium">{data.wrongAnswers}</span> erros
              </p>
            )}
            <p className="text-muted-foreground">
              {formatPercentage(data.value)} do tempo total
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  const legendMaxHeightClass = useBarLayout ? '' : 'max-h-40 overflow-y-auto';

  const CustomLegend = ({ payload }: { payload?: LegendPayloadEntry[] }) => {
    if (!payload || payload.length === 0) return null;

    return (
      <div
        className={`flex flex-wrap gap-x-4 gap-y-2 justify-center mt-4 px-1 ${legendMaxHeightClass}`}
      >
        {payload.map((entry, index: number) => (
          <div key={index} className="flex items-start gap-2 text-sm max-w-[200px]">
            <div
              className="w-3 h-3 rounded-full shrink-0 mt-0.5"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-muted-foreground text-left leading-snug break-words">
              {entry.value} <span className="text-foreground">({formatPercentage(entry.payload.value)})</span>
            </span>
          </div>
        ))}
      </div>
    );
  };

  /** Altura proporcional ao número de disciplinas (leitura sem amontoar). */
  const barChartHeight = useMemo(() => {
    const perRow = 36;
    const padding = 80;
    return Math.min(Math.max(chartData.length * perRow + padding, 220), 960);
  }, [chartData.length]);

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            📊 Distribuição do Tempo por Disciplina
          </CardTitle>
          <CardDescription>
            Tempo de estudo dedicado a cada disciplina
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="text-4xl mb-2">📚</div>
            <p className="text-sm text-muted-foreground">
              Nenhuma disciplina registrada ainda
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Comece a estudar para ver a distribuição do tempo
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          📊 Distribuição do Tempo por Disciplina
        </CardTitle>
        <CardDescription>
          {useBarLayout
            ? `${chartData.length} disciplinas — visualização em barras para melhor leitura`
            : 'Tempo de estudo dedicado a cada disciplina'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {useBarLayout ? (
          <div
            className="w-full overflow-x-auto"
            style={{ minHeight: barChartHeight }}
          >
            <ResponsiveContainer width="100%" height={barChartHeight}>
              <BarChart
                layout="vertical"
                data={chartData}
                margin={{ left: 8, right: 24, top: 8, bottom: 8 }}
                barCategoryGap="12%"
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" horizontal={false} />
                <XAxis
                  type="number"
                  tickFormatter={(v) => (Number(v) < 1 ? `${Math.round(Number(v) * 60)}m` : `${v}h`)}
                  className="text-xs"
                  stroke="hsl(var(--muted-foreground))"
                />
                <YAxis
                  type="category"
                  dataKey="short"
                  width={148}
                  tick={{ fontSize: 11 }}
                  interval={0}
                  stroke="hsl(var(--muted-foreground))"
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted) / 0.15)' }} />
                <Bar dataKey="value" name="Tempo" radius={[0, 4, 4, 0]} maxBarSize={28}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-80 md:h-96">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={false}
                  outerRadius={100}
                  innerRadius={52}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend content={<CustomLegend />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="mt-4 p-3 bg-muted/50 rounded-lg">
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">Disciplinas:</span>
              <span className="font-medium text-foreground">{chartData.length}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">Total:</span>
              <span className="font-medium text-foreground">{formatHours(totalHours)}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default SubjectTimeDistributionChart;
