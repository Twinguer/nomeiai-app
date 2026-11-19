import { useQuery } from '@tanstack/react-query';
import { UserStudyService } from '@/services/userStudyService';
import { resolveUserStudyStatisticsFromData } from '@/modules/statistics';
import {
  fetchCoachStudentDetails,
  type CoachStudentDetails,
} from '../services/coachStudentListService';
import type { StudyStatistics } from '@/types/userStudy';

type UseCoachStudentDetailsOptions = {
  coachId?: string;
  validatedStudentId: string | null;
  hasAccess: boolean;
};

export function useCoachStudentDetails({
  coachId,
  validatedStudentId,
  hasAccess,
}: UseCoachStudentDetailsOptions) {
  const studentQuery = useQuery({
    queryKey: ['coach-student', coachId, validatedStudentId],
    queryFn: () => fetchCoachStudentDetails(coachId!, validatedStudentId!),
    enabled: !!coachId && !!validatedStudentId && hasAccess,
  });

  const statisticsQuery = useQuery({
    queryKey: ['coach-student-statistics', validatedStudentId],
    queryFn: async (): Promise<StudyStatistics | null> => {
      if (!validatedStudentId) return null;
      const userStudyData = await UserStudyService.getUserStudyData(validatedStudentId);
      if (!userStudyData) return null;
      return resolveUserStudyStatisticsFromData(userStudyData);
    },
    enabled: !!validatedStudentId && hasAccess,
  });

  const isLoadingStudent = studentQuery.isLoading;
  const isLoadingStatistics = statisticsQuery.isLoading;

  return {
    student: studentQuery.data as CoachStudentDetails | null | undefined,
    fullStatistics: statisticsQuery.data,
    isLoadingStudent,
    isLoadingStatistics,
    isLoading: isLoadingStudent || isLoadingStatistics,
    refetchStudent: studentQuery.refetch,
  };
}

export type { CoachStudentDetails };
