import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Briefcase, ExternalLink, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { syncPciConcursoFeedFromAdmin } from '@/services/pciConcursoFeedService';
import { ADMIN_METRICS_QUERY_KEY, type AdminMetricsPciFeed } from '@/types/adminMetrics';

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR');
}

interface PciConcursoFeedSyncProps {
  pciFeed?: AdminMetricsPciFeed;
  isMetricsLoading: boolean;
}

const PciConcursoFeedSync: React.FC<PciConcursoFeedSyncProps> = ({ pciFeed, isMetricsLoading }) => {
  const queryClient = useQueryClient();
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const result = await syncPciConcursoFeedFromAdmin();
      await queryClient.invalidateQueries({ queryKey: ADMIN_METRICS_QUERY_KEY });
      await queryClient.invalidateQueries({ queryKey: ['pci-concurso-feed'] });
      toast.success(
        `Feed atualizado: ${result.total} concursos (${result.deactivated} removidos da lista ativa).`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao sincronizar';
      toast.error(message);
    } finally {
      setSyncing(false);
    }
  };

  const lastRun = pciFeed?.last_sync;
  const lastRunLabel =
    lastRun?.status === 'ok'
      ? `OK — ${lastRun.items_upserted ?? 0} registros`
      : lastRun?.status === 'failed'
        ? `Falhou — ${lastRun.error_message ?? 'erro desconhecido'}`
        : lastRun?.status === 'running'
          ? 'Em andamento…'
          : '—';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-primary" />
              Concursos PCI (feed público)
            </CardTitle>
            <CardDescription>
              Atualiza a página <strong>/concursos</strong> a partir do PCI. Execute após mudanças no site
              fonte ou quando quiser refrescar a lista.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" asChild>
            <a href="/concursos" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-1" />
              Ver página
            </a>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
          <div className="rounded-md border border-border p-3">
            <p className="text-muted-foreground">Concursos ativos</p>
            <p className="text-xl font-semibold mt-1">
              {isMetricsLoading ? '…' : (pciFeed?.active_count ?? 0)}
            </p>
          </div>
          <div className="rounded-md border border-border p-3">
            <p className="text-muted-foreground">Último scrap no feed</p>
            <p className="font-medium mt-1">{formatDateTime(pciFeed?.last_scraped_at)}</p>
          </div>
          <div className="rounded-md border border-border p-3">
            <p className="text-muted-foreground">Última sincronização</p>
            <p className="font-medium mt-1">
              {formatDateTime(lastRun?.finished_at ?? lastRun?.started_at)}
            </p>
            <p className="text-muted-foreground text-xs mt-0.5">{lastRunLabel}</p>
          </div>
        </div>

        <Button onClick={handleSync} disabled={syncing || isMetricsLoading} className="gap-2">
          {syncing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          {syncing ? 'Sincronizando…' : 'Sincronizar concursos PCI'}
        </Button>
        <p className="text-xs text-muted-foreground">
          Pode levar até um minuto. Mantenha esta aba aberta até concluir.
        </p>
      </CardContent>
    </Card>
  );
};

export default PciConcursoFeedSync;
