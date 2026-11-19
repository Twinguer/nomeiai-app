
import { useQuery } from '@tanstack/react-query';
import { getParticipantCount } from '@/services/concursoService';

export function useParticipantCount(concursoId: string) {
  const {
    data: participantCount = 0,
    isLoading,
    error
  } = useQuery({
    queryKey: ['participant-count', concursoId],
    queryFn: () => getParticipantCount(concursoId),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000,   // 10 minutes
  });

  return {
    participantCount,
    isLoading,
    error
  };
}
