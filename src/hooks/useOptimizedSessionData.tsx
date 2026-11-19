import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { UserStudyService } from '@/services/userStudyService';
import { getScheduleSessions } from '@/modules/study';
import type { UserStudy } from '@/types/userStudy';
import { devLog } from '@/utils/productionLogger';

interface SessionData {
  id: string;
  cycle_name: string;
  duration_minutes: number;
  questions: number;
  correct_answers: number;
  session_count: number;
  session_link?: string;
}

interface UseOptimizedSessionDataReturn {
  sessionData: Record<string, SessionData>;
  loading: boolean;
  error: string | null;
  refreshData: () => Promise<void>;
}

interface UseOptimizedSessionDataOptions {
  dependencies?: unknown[];
  targetUserId?: string;
}

function processAllSessions(userStudyData: UserStudy): Record<string, SessionData> {
  const allSessionData: Record<string, SessionData> = {};
  const scheduleSessions = getScheduleSessions(userStudyData);

  for (const session of scheduleSessions) {
    const cycle = userStudyData.study_cycles?.find((c) => c.id === session.cycle_id);
    allSessionData[session.id] = {
      id: session.id,
      cycle_name: cycle?.cycle_name || 'Ciclo desconhecido',
      duration_minutes: session.total_stats?.total_duration_minutes || 0,
      questions: session.total_stats?.total_questions || 0,
      correct_answers: session.total_stats?.total_correct || 0,
      session_count: session.total_stats?.session_count || 1,
      session_link: session.session_link,
    };
  }

  return allSessionData;
}

/**
 * Hook otimizado para carregar dados de sessão
 * - Uma única chamada ao banco
 * - Cache inteligente
 * - Refresh manual
 */
export const useOptimizedSessionData = (
  options: UseOptimizedSessionDataOptions = {}
): UseOptimizedSessionDataReturn => {
  const { user } = useAuth();
  const { targetUserId } = options;
  const [sessionData, setSessionData] = useState<Record<string, SessionData>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lastFetchRef = useRef(0);

  const CACHE_DURATION = 30 * 1000;

  const loadData = useCallback(async (forceRefresh = false) => {
    const userId = targetUserId || user?.id;
    if (!userId) {
      setSessionData({});
      setLoading(false);
      return;
    }

    const now = Date.now();
    const isCacheValid =
      !forceRefresh &&
      now - lastFetchRef.current < CACHE_DURATION &&
      lastFetchRef.current > 0;

    if (isCacheValid) {
      devLog.log('📦 Usando dados em cache');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const userStudyData = await UserStudyService.getUserStudyData(userId);

      if (!userStudyData) {
        devLog.warn('⚠️ Nenhum dado do usuário encontrado');
        setSessionData({});
        return;
      }

      setSessionData(processAllSessions(userStudyData));
      lastFetchRef.current = now;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      devLog.error('❌ Erro ao carregar dados de sessão', err);
      setError(errorMessage);
      setSessionData({});
    } finally {
      setLoading(false);
    }
  }, [user?.id, targetUserId]);

  const refreshData = useCallback(async () => {
    await loadData(true);
  }, [loadData]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return {
    sessionData,
    loading,
    error,
    refreshData,
  };
};
