import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Building, Crown, GraduationCap, User, Users } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { NotificationManager } from '@/components/Admin/NotificationManager';
import MonitoringMetrics from '@/components/Admin/MonitoringMetrics';
import PciConcursoFeedSync from '@/components/Admin/PciConcursoFeedSync';
import { fetchAdminMetrics } from '@/services/adminMetricsService';
import { ADMIN_METRICS_QUERY_KEY } from '@/types/adminMetrics';
import { useAdminNavLinks } from '@/hooks/useAdminNavLinks';
import { usePresence } from '@/contexts/PresenceContext';

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR');
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
      return 'text-green-500 dark:text-green-400';
    case 'warning':
      return 'text-yellow-500 dark:text-yellow-400';
    case 'critical':
      return 'text-red-500 dark:text-red-400';
    default:
      return 'text-muted-foreground';
  }
}

const AdminDashboard: React.FC = () => {
  const { links } = useAdminNavLinks();
  const { onlineUserIds } = usePresence();
  const { data, isLoading, error } = useQuery({
    queryKey: ADMIN_METRICS_QUERY_KEY,
    queryFn: fetchAdminMetrics,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const m = data?.metrics;

  const dashboardCards = [
    {
      title: 'Rankings ativos',
      value: isLoading ? '…' : String(m?.rankings.active ?? 0),
      description: 'Status “Em andamento”',
      icon: <Building className="h-6 w-6 text-amber-500" />,
    },
    {
      title: 'Usuários registrados',
      value: isLoading ? '…' : String(m?.users.total ?? 0),
      description: 'Perfis em users_profiles',
      icon: <User className="h-6 w-6 text-purple-500" />,
    },
    {
      title: 'Ativos (24h)',
      value: isLoading ? '…' : String(m?.users.active_24h ?? 0),
      description: 'Com last_activity nas últimas 24h',
      icon: <Users className="h-6 w-6 text-green-500" />,
    },
    {
      title: 'Usuários Pro',
      value: isLoading ? '…' : String(m?.subscriptions.user_subscriptions.pro_active ?? 0),
      description: isLoading
        ? ''
        : `${m?.subscriptions.user_subscriptions.pro ?? 0} no plano Pro (incl. inativos)`,
      icon: <Crown className="h-6 w-6 text-amber-400" />,
    },
    {
      title: 'Assinaturas Coach',
      value: isLoading ? '…' : String(m?.subscriptions.coach_subscriptions.active ?? 0),
      description: isLoading
        ? ''
        : `${m?.coach.total_coaches ?? 0} perfis coach · ${m?.subscriptions.coach_subscriptions.total ?? 0} assinaturas no total`,
      icon: <GraduationCap className="h-6 w-6 text-blue-500" />,
    },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Painel Administrativo</h1>

      {error && (
        <div className="mb-6 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Não foi possível carregar as métricas do backend. Tente recarregar a página.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2 mb-8">
        {dashboardCards.map((card, index) => (
          <Card key={index}>
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <CardTitle className="text-md font-medium">{card.title}</CardTitle>
                {card.icon}
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
              <CardDescription>{card.description}</CardDescription>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mb-8">
        <MonitoringMetrics
          metrics={m}
          timestamp={data?.timestamp}
          isLoading={isLoading}
          onlineUsersCount={onlineUserIds.size}
        />
      </div>

      <div className="mb-8">
        <NotificationManager />
      </div>

      <div className="mb-8">
        <PciConcursoFeedSync pciFeed={m?.pci_feed} isMetricsLoading={isLoading} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-1 lg:grid-cols-2 gap-2">
        <Card>
          <CardHeader>
            <CardTitle>Ações Rápidas</CardTitle>
            <CardDescription>Acesse as principais funcionalidades</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link
              to="/criar-ranking"
              className="block p-3 bg-muted hover:bg-muted/80 rounded-md transition-colors"
            >
              Cadastrar Novo Ranking
            </Link>
            <Link
              to={links.concursos}
              className="block p-3 bg-muted hover:bg-muted/80 rounded-md transition-colors"
            >
              Gerenciar Rankings
            </Link>
            <Link
              to={links.usuarios}
              className="block p-3 bg-muted hover:bg-muted/80 rounded-md transition-colors"
            >
              Gerenciar Usuários
            </Link>
            <Link
              to={links.vouchers}
              className="block p-3 bg-muted hover:bg-muted/80 rounded-md transition-colors"
            >
              Gerenciar Vouchers
            </Link>
            <a href="/" target="_blank" rel="noopener noreferrer" className="block p-3 bg-muted hover:bg-muted/80 rounded-md transition-colors">
              Visualizar Site
            </a>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Informações do Sistema</CardTitle>
            <CardDescription>Dados agregados no backend (Edge Function metrics)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">Métricas atualizadas</span>
                <span className="font-medium">{formatDateTime(data?.timestamp)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">Saúde do sistema</span>
                <span className={`font-medium ${healthClass(m?.system.health ?? '')}`}>
                  {isLoading ? '…' : healthLabel(m?.system.health ?? '')}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">Engajamento (24h)</span>
                <span className="font-medium">{isLoading ? '…' : `${m?.system.engagement_rate ?? 0}%`}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">Alertas críticos</span>
                <span className="font-medium">{isLoading ? '…' : m?.performance.critical_alerts ?? 0}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">Usuários Pro (ativos)</span>
                <span className="font-medium">{isLoading ? '…' : m?.subscriptions.user_subscriptions.pro_active ?? 0}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">Coach (assinaturas ativas)</span>
                <span className="font-medium">{isLoading ? '…' : m?.subscriptions.coach_subscriptions.active ?? 0}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-muted-foreground">Rankings (total)</span>
                <span className="font-medium">{isLoading ? '…' : m?.rankings.total ?? 0}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminDashboard;
