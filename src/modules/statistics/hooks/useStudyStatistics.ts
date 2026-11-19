import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { StudyStatistics, defaultUserStudy, StudySession } from '@/types/userStudy';
import { devLog } from '@/utils/productionLogger';
import { getFilteredPeriodSummary, type StudyTimeFilter } from '../domain/statisticsFilters';
import { resolveStudySessions, resolveUserStudyStatisticsFromData } from '../domain/statisticsMerge';
import { statisticsService } from '../services/statisticsService';

let globalPersistInProgress = false;

export function useStudyStatistics() {
  const { user } = useAuth();
  const [statistics, setStatistics] = useState<StudyStatistics>(
    defaultUserStudy.study_statistics as StudyStatistics
  );
  const [isLoading, setIsLoading] = useState(true);

  const persistSessionsAndStats = useCallback(
    async (sessions: StudySession[], stats: StudyStatistics) => {
      if (!user) return false;
      if (globalPersistInProgress) return false;

      globalPersistInProgress = true;
      try {
        const ok = await statisticsService.saveSessionsAndStatistics(user.id, sessions, stats);
        if (!ok) {
          devLog.error('Error persisting study statistics');
        }
        return ok;
      } finally {
        globalPersistInProgress = false;
      }
    },
    [user]
  );

  const loadStatistics = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    try {
      const userStudyData = await statisticsService.loadUserStudyData(user.id, true);

      if (!userStudyData) {
        setStatistics(defaultUserStudy.study_statistics as StudyStatistics);
        return;
      }

      const sessions = resolveStudySessions(
        userStudyData.study_sessions,
        userStudyData.study_statistics
      );
      const resolvedStats = resolveUserStudyStatisticsFromData(userStudyData);

      setStatistics(resolvedStats);

      const rawCount = userStudyData.study_sessions?.length ?? 0;
      const mergedOrphans = sessions.length > rawCount;
      const importedFromHistory = rawCount === 0 && sessions.length > 0;
      if (importedFromHistory || mergedOrphans) {
        persistSessionsAndStats(sessions, resolvedStats).catch((err) => {
          devLog.error('Error persisting merged study sessions:', err);
        });
      }
    } catch (error) {
      devLog.error('Error loading statistics:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user, persistSessionsAndStats]);

  const resetStatistics = async () => {
    if (!user) return;

    try {
      await statisticsService.resetUserStatistics(user.id);
      setStatistics(defaultUserStudy.study_statistics as StudyStatistics);
    } catch (error) {
      devLog.error('Error resetting statistics:', error);
    }
  };

  const getFilteredStats = (filter: StudyTimeFilter) => {
    return getFilteredPeriodSummary(statistics, filter);
  };

  useEffect(() => {
    loadStatistics();
  }, [loadStatistics]);

  return {
    statistics,
    isLoading,
    resetStatistics,
    getFilteredStats,
    refreshStatistics: loadStatistics,
  };
}
