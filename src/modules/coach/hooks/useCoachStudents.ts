import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { logError } from '@/utils/secureLogger';
import {
  fetchCoachStudentsWithDetails,
  type CoachStudentListItem,
} from '../services/coachStudentListService';
import { coachRelationshipService } from '../services/coachRelationshipService';

type UseCoachStudentsOptions = {
  enabled?: boolean;
};

export function useCoachStudents(options: UseCoachStudentsOptions = {}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const enabled = options.enabled !== false && !!user;

  const studentsQuery = useQuery({
    queryKey: ['coach-students', user?.id],
    queryFn: () => fetchCoachStudentsWithDetails(user!.id),
    enabled,
  });

  const removeStudentMutation = useMutation({
    mutationFn: async (studentId: string) => {
      try {
        await coachRelationshipService.removeStudent(user!.id, studentId);
      } catch (error) {
        logError('Erro ao remover aluno', error, 'COACH');
        throw error;
      }
    },
    onSuccess: () => {
      toast({
        title: 'Aluno removido',
        description: 'O aluno foi removido da sua equipe',
      });
      queryClient.invalidateQueries({ queryKey: ['coach-students', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['coach-can-invite', user?.id] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao remover aluno',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const students: CoachStudentListItem[] = studentsQuery.data ?? [];

  return {
    students,
    isLoading: studentsQuery.isLoading,
    refetchStudents: studentsQuery.refetch,
    removeStudent: removeStudentMutation.mutate,
    isRemovingStudent: removeStudentMutation.isPending,
  };
}

export type { CoachStudentListItem };
