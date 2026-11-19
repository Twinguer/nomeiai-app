import { UserStudyService } from '@/services/userStudyService';
import type { StudySession, StudyStatistics } from '@/types/userStudy';
import { devLog } from '@/utils/productionLogger';

export const statisticsService = {
  async loadUserStudyData(userId: string, forceRefresh = true) {
    if (forceRefresh) {
      UserStudyService.clearCache(userId);
    }
    return UserStudyService.getUserStudyData(userId, forceRefresh);
  },

  async getStatistics(userId: string): Promise<StudyStatistics | null> {
    return UserStudyService.getStatistics(userId);
  },

  async updateStatistics(userId: string, statistics: StudyStatistics): Promise<boolean> {
    return UserStudyService.updateStatistics(userId, statistics);
  },

  async saveSessionsAndStatistics(
    userId: string,
    studySessions: StudySession[],
    statistics: StudyStatistics
  ): Promise<boolean> {
    try {
      return await UserStudyService.saveSessionsAndStatistics(userId, studySessions, statistics);
    } catch (error) {
      devLog.error('Error persisting study statistics', error);
      return false;
    }
  },

  async resetUserStatistics(userId: string): Promise<void> {
    await UserStudyService.deleteUserStudyData(userId);
    await UserStudyService.initializeUserStudyData(userId);
  },
};
