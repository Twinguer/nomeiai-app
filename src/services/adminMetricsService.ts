import { supabase } from '@/integrations/supabase/client';
import type { AdminMetricsPayload } from '@/types/adminMetrics';

export async function fetchAdminMetrics(): Promise<AdminMetricsPayload> {
  const { data, error } = await supabase.functions.invoke('metrics', {
    method: 'GET',
  });

  if (error) throw error;

  const payload = data as AdminMetricsPayload;
  if (!payload || payload.status === 'error') {
    throw new Error(payload?.error ?? 'Falha ao carregar métricas do sistema');
  }

  return payload;
}
