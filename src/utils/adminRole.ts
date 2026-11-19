import { supabase } from '@/integrations/supabase/client';
import { devLog } from '@/utils/productionLogger';

type PlatformRole = 'admin' | 'moderator' | 'user';

export async function fetchCurrentUserPlatformRole(): Promise<PlatformRole | null> {
  try {
    const { data, error } = await supabase.rpc('get_current_user_role');

    if (error) {
      devLog.error('fetchCurrentUserPlatformRole failed', error);
      return null;
    }

    if (!data) {
      return null;
    }

    return data as PlatformRole;
  } catch (error) {
    devLog.error('fetchCurrentUserPlatformRole failed', error);
    return null;
  }
}

/** Checa admin via RPC server-side (auth.uid), sem consultar user_roles no cliente. */
export async function checkIsPlatformAdmin(): Promise<boolean> {
  const role = await fetchCurrentUserPlatformRole();
  return role === 'admin';
}
