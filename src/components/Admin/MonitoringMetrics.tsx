import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, BarChart3, Calendar, Users } from 'lucide-react';
import { formatScore } from '@/lib/utils';
import type { AdminMetricsPayload } from '@/types/adminMetrics';

type MetricsSlice = AdminMetricsPayload['metrics'];

interface MonitoringMetricsProps {
  metrics?: MetricsSlice;
  timestamp?: string;
  isLoading: boolean;
  onlineUsersCount: number;
}

function healthLabel(health: string): string {
  switch (health) {
    case 'healthy':
      return 'Saudável';
    case 'warning':
      return 'Atenção';
    case 'critical':
      return 'Crítico';
    default:
      return 'Desconhecido';
  }
}

function healthClass(health: string): string {
  switch (health) {
    case 'healthy':
      return 'text-green-500';
    case 'warning':
      return 'text-yellow-500';
    case 'critical':
      return 'text-red-500';
    default:
      return 'text-gray-500';
  }
}

const MonitoringMetrics: React.FC<MonitoringMetricsProps> = ({
  metrics,
  timestamp,
  isLoading,
  onlineUsersCount,
}) => {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Métricas de Monitoramento
          </CardTitle>
          <CardDescription>Carregando dados do backend…</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!metrics) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Métricas de Monitoramento
          </CardTitle>
          <CardDescription>Sem dados disponíveis</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const engagement = metrics.system.engagement_rate;
  const health = metrics.system.health;

  const topMetrics = [
    {
      title: 'Usuários online agora',
      value: onlineUsersCount,
      description: 'Conectados neste momento · tempo real',
      icon: <Users className="h-5 w-5" />,
      color: 'text-green-500',
    },
    {
      title: 'Engajamento (24h)',
      value: `${engagement}%`,
      description: 'Usuários ativos / total de registrados',
      icon: <Activity className="h-5 w-5" />,
      color: engagement > 30 ? 'text-green-500' : engagement > 10 ? 'text-yellow-500' : 'text-red-500',
    },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Status do Sistema
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Saúde (backend)</p>
              <p className={`text-2xl font-bold ${healthClass(health)}`}>{healthLabel(health)}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Coletado em</p>
              <p className="text-sm font-medium">
                {timestamp ? new Date(timestamp).toLocaleString('pt-BR') : '—'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {topMetrics.map((metric, index) => (
          <Card key={index}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">{metric.title}</CardTitle>
                <div className={metric.color}>{metric.icon}</div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metric.value}</div>
              <CardDescription className="text-xs">{metric.description}</CardDescription>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Rankings e pontuações
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Participações (total)</span>
              <span className="font-medium text-purple-600">{metrics.rankings.participations}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Novas participações (24h)</span>
              <span className="font-medium">{metrics.rankings.participations_24h}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Pontuação média</span>
              <span className="font-medium">{formatScore(metrics.scores.average)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Maior pontuação</span>
              <span className="font-medium text-blue-600">{formatScore(metrics.scores.highest)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Registros com score</span>
              <span className="font-medium">{metrics.scores.total_scored}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Rankings e usuários
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Rankings ativos</span>
              <span className="font-medium">{metrics.rankings.active}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Rankings (total)</span>
              <span className="font-medium">{metrics.rankings.total}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Usuários ativos (7d)</span>
              <span className="font-medium">{metrics.users.active_7d}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Média participantes/ranking</span>
              <span className="font-medium">{metrics.concursos.avg_participation_rate}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Alertas ativos</span>
              <span className="font-medium">{metrics.performance.active_alerts}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Planos Pro e Coach
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Pro (ativos)</span>
              <span className="font-medium text-amber-600">{metrics.subscriptions.user_subscriptions.pro_active}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Pro (total no plano)</span>
              <span className="font-medium">{metrics.subscriptions.user_subscriptions.pro}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Free</span>
              <span className="font-medium">{metrics.subscriptions.user_subscriptions.free}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Coach ativos</span>
              <span className="font-medium text-blue-600">{metrics.subscriptions.coach_subscriptions.active}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Coach por plano (ativos)</span>
              <span className="font-medium text-xs text-right">
                Starter {metrics.subscriptions.coach_subscriptions.starter} · Prof.{' '}
                {metrics.subscriptions.coach_subscriptions.professional} · Ent.{' '}
                {metrics.subscriptions.coach_subscriptions.enterprise}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Perfis coach</span>
              <span className="font-medium">{metrics.coach.total_coaches}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default MonitoringMetrics;
