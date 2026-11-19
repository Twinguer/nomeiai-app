import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { devLog } from '@/utils/productionLogger';
import { logError } from '@/utils/secureLogger';
import {
  coachInvitationService,
  type CoachInviteSearchUser,
  type CoachPendingInvitation,
} from '../services/coachInvitationService';

export function useCoachInvitations(options: { enabled?: boolean } = {}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const enabled = options.enabled !== false && !!user;

  const pendingQuery = useQuery({
    queryKey: ['coach-pending-invitations', user?.id],
    queryFn: async () => {
      try {
        return await coachInvitationService.fetchPendingInvitations(user!.id);
      } catch (err: unknown) {
        logError('Erro completo ao buscar convites', err, 'COACH');
        const error = err as { code?: string; message?: string };
        if (error.code === 'PGRST301' || error.message?.includes('403')) {
          return [];
        }
        throw err;
      }
    },
    enabled,
    retry: 2,
    retryDelay: 2000,
  });

  const cancelMutation = useMutation({
    mutationFn: (invitationId: string) =>
      coachInvitationService.cancelInvitation(user!.id, invitationId),
    onSuccess: (data) => {
      toast({
        title: 'Convite cancelado',
        description: data?.message || 'O convite foi cancelado com sucesso',
      });
      pendingQuery.refetch();
      queryClient.invalidateQueries({ queryKey: ['coach-pending-invitations'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (error: Error) => {
      devLog.error('Erro completo ao cancelar convite:', error);
      toast({
        title: 'Erro ao cancelar convite',
        description: error.message || 'Não foi possível cancelar o convite',
        variant: 'destructive',
      });
    },
  });

  return {
    pendingInvitations: (pendingQuery.data ?? []) as CoachPendingInvitation[],
    isLoadingInvitations: pendingQuery.isLoading,
    refetchInvitations: pendingQuery.refetch,
    cancelInvitation: cancelMutation.mutate,
    isCancellingInvitation: cancelMutation.isPending,
  };
}

export function useCoachInviteUserSearch(searchQuery: string) {
  const trimmed = searchQuery.trim();
  const enabled = trimmed.length >= 2;

  return useQuery({
    queryKey: ['search-users-for-invite', trimmed],
    queryFn: () => coachInvitationService.searchUsersForInvite(trimmed),
    enabled,
  });
}

export function useSendCoachInvitation() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      nickname,
      message,
    }: {
      nickname: string;
      message: string | null;
    }) => {
      const result = await coachInvitationService.sendInvitation(
        user!.id,
        nickname,
        message
      );

      if (!result.success) {
        throw new Error(result.error || 'Erro ao enviar convite');
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coach-students'] });
      queryClient.invalidateQueries({ queryKey: ['coach-can-invite'] });
      queryClient.invalidateQueries({ queryKey: ['coach-pending-invitations'] });
    },
    onError: (error: Error) => {
      devLog.error('Erro ao convidar aluno:', error);
      toast({
        title: 'Erro ao convidar',
        description: error.message || 'Não foi possível convidar o aluno',
        variant: 'destructive',
      });
    },
  });
}

export type { CoachInviteSearchUser, CoachPendingInvitation };
