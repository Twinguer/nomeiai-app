import { supabase } from '@/integrations/supabase/client';
import { isLaunchProPromoActive } from './launchPromo';

/** RPC ainda não deployado no projeto remoto (404 / PGRST202). */
function isMissingRpcError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === 'PGRST202') return true;
  const msg = error.message ?? '';
  return msg.includes('Could not find the function') || msg.includes('404');
}

/** Evita POST 404 repetido quando a migration ainda não foi aplicada no Supabase. */
let ensureLaunchProRpcUnavailable = false;

/**
 * Garante Pro de lançamento no banco (idempotente).
 * Ignora silenciosamente se a migration ainda não foi aplicada no Supabase.
 */
export async function ensureLaunchProSubscriptionIfPromoActive(): Promise<void> {
  if (!isLaunchProPromoActive() || ensureLaunchProRpcUnavailable) {
    return;
  }

  const { error } = await supabase.rpc('ensure_launch_pro_for_current_user');

  if (isMissingRpcError(error)) {
    ensureLaunchProRpcUnavailable = true;
    return;
  }

  if (error && import.meta.env.DEV) {
    console.warn('[ensureLaunchPro] RPC falhou:', error.message);
  }
}
