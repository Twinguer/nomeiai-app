import { supabase } from '@/integrations/supabase/client';
import type { PciConcursoFeedItem, PciConcursoFeedSyncResult } from '@/types/pciConcursoFeed';

const TABLE = 'pci_concurso_feed';

export async function fetchPciConcursoFeed(): Promise<{
  items: PciConcursoFeedItem[];
  lastScrapedAt: string | null;
}> {
  const { data, error } = await supabase
    .from(TABLE)
    .select(
      'id, titulo, regiao, uf, vagas, vagas_texto, salario_min, salario_max, salario_texto, cargos, escolaridade, resumo, inscricao_ate, inscricao_texto, status, scraped_at',
    )
    .eq('is_active', true)
    .order('regiao', { ascending: true })
    .order('titulo', { ascending: true });

  if (error) throw error;

  const items = (data || []) as PciConcursoFeedItem[];
  const lastScrapedAt =
    items.reduce<string | null>((max, row) => {
      if (!row.scraped_at) return max;
      if (!max || row.scraped_at > max) return row.scraped_at;
      return max;
    }, null);

  return { items, lastScrapedAt };
}

export async function syncPciConcursoFeedFromAdmin(): Promise<PciConcursoFeedSyncResult> {
  const { data, error } = await supabase.functions.invoke('sync-pci-concursos', {
    method: 'POST',
    body: {},
  });

  const payload = data as (PciConcursoFeedSyncResult & { error?: string }) | null;

  if (error) {
    const detail =
      payload?.error ||
      (typeof data === 'object' && data && 'error' in data ? String((data as { error: string }).error) : null);
    throw new Error(detail || error.message || 'Erro ao sincronizar concursos PCI');
  }

  if (payload?.error) {
    throw new Error(payload.error);
  }
  if (!payload?.ok) {
    throw new Error('Sincronização falhou');
  }

  return payload;
}
