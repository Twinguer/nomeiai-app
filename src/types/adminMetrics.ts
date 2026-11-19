export type SystemHealth = 'healthy' | 'warning' | 'critical';

export interface AdminMetricsPciFeed {
  active_count: number;
  last_scraped_at: string | null;
  last_sync: {
    status: string;
    started_at: string;
    finished_at: string | null;
    items_upserted: number | null;
    items_deactivated: number | null;
    error_message: string | null;
  } | null;
}

export interface AdminMetricsPayload {
  timestamp: string;
  status: 'ok' | 'error';
  metrics: {
    users: {
      total: number;
      online: number;
      active_24h: number;
      active_7d: number;
    };
    rankings: {
      total: number;
      active: number;
      participations: number;
      participations_24h: number;
    };
    scores: {
      average: number;
      highest: number;
      lowest: number;
      total_scored: number;
    };
    system: {
      health: SystemHealth;
      engagement_rate: number;
      uptime_percentage: number;
    };
    performance: {
      avg_query_time_ms: number;
      slow_queries_count: number;
      active_alerts: number;
      critical_alerts: number;
    };
    concursos: {
      by_status: {
        em_andamento: number;
        finalizado: number;
        inativo: number;
      };
      avg_participation_rate: number;
    };
    pci_feed: AdminMetricsPciFeed;
    subscriptions: {
      user_subscriptions: {
        pro: number;
        pro_active: number;
        free: number;
      };
      coach_subscriptions: {
        active: number;
        total: number;
        starter: number;
        professional: number;
        enterprise: number;
      };
    };
    coach: {
      total_coaches: number;
    };
  };
  error?: string;
}

export const ADMIN_METRICS_QUERY_KEY = ['admin-metrics'] as const;
