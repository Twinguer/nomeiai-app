import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { coachSubscriptionService, isActiveCoachSubscription } from '@/modules/coach';
import { hasLaunchPromoProAccess } from '@/modules/payments';
import { studyGroupMembersService } from '../services/studyGroupMembersService';

export function useGroupMembers(groupId: string | undefined) {
  const { data: members = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['group-members', groupId],
    queryFn: () => studyGroupMembersService.getGroupMembers(groupId!),
    enabled: !!groupId,
  });

  return { members, isLoading, isError, refetch };
}

export function useIsGroupMember(groupId: string | undefined) {
  const { user } = useAuth();
  const { members, isLoading: isLoadingMembers } = useGroupMembers(groupId);

  const { data: userStatus, isLoading: isLoadingStatus } = useQuery({
    queryKey: ['user-group-status', groupId, user?.id],
    queryFn: () => studyGroupMembersService.getUserGroupStatus(groupId!, user!.id),
    enabled: !!groupId && !!user,
  });

  const userMember = members.find((m) => m.user_id === user?.id || m.id === user?.id);
  const isMember = userStatus?.is_member ?? !!userMember;
  const memberRole = userMember?.role ?? userStatus?.role;

  return {
    isMember,
    memberRole,
    isCoach: memberRole === 'coach',
    isAdmin: memberRole === 'admin' || memberRole === 'coach',
    hasRequested: userStatus?.has_requested ?? false,
    isInvited: userStatus?.is_invited ?? false,
    isLoading: isLoadingMembers || isLoadingStatus,
  };
}

export function useRequestToJoin() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: async (groupId: string) => {
      if (!user?.id) throw new Error('Usuário não autenticado');

      const { data: userIsProRpc } = await supabase.rpc('is_user_pro', { p_user_id: user.id });
      const userIsPro = userIsProRpc === true || hasLaunchPromoProAccess(user.id);

      let userIsCoach = false;
      try {
        const coachSubscription = await coachSubscriptionService.getCoachSubscription(user.id);
        userIsCoach = isActiveCoachSubscription(coachSubscription);
      } catch {
        // RLS ou indisponível — tratar como não-coach
      }

      if (!userIsPro && !userIsCoach) {
        toast({
          title: 'Grupos disponíveis apenas para assinantes',
          description: 'Faça upgrade para participar de grupos de estudos.',
          variant: 'destructive',
        });
        setTimeout(() => navigate('/planos'), 2000);
        throw new Error('Grupos de estudos estão disponíveis apenas para assinantes.');
      }

      return studyGroupMembersService.requestToJoinGroup(groupId, user.id);
    },
    onSuccess: (result, groupId) => {
      queryClient.invalidateQueries({ queryKey: ['group-members', groupId] });
      queryClient.invalidateQueries({ queryKey: ['study-group', groupId] });
      queryClient.invalidateQueries({ queryKey: ['user-groups', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['pending-requests', groupId] });
      queryClient.invalidateQueries({ queryKey: ['user-group-status', groupId] });

      if (result.success) {
        toast({
          title: result.message || 'Pedido enviado!',
          description: 'Aguarde a aprovação do administrador.',
        });
      } else if (
        result.error?.includes('assinante') ||
        result.error?.includes('upgrade') ||
        result.requires_upgrade
      ) {
        toast({
          title: 'Grupos disponíveis apenas para assinantes',
          description: 'Faça upgrade para participar de grupos de estudos.',
          variant: 'destructive',
        });
        setTimeout(() => navigate('/planos'), 2000);
      } else if (
        result.error?.includes('privado') ||
        result.error?.includes('convite') ||
        result.requires_invite
      ) {
        toast({
          title: 'Grupo privado',
          description: result.error || 'Este grupo é privado. Apenas membros convidados podem participar.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Aviso',
          description: result.error || 'Não foi possível enviar o pedido.',
          variant: 'destructive',
        });
      }
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : '';
      if (errorMessage.includes('assinante') || errorMessage.includes('upgrade')) {
        toast({
          title: 'Grupos disponíveis apenas para assinantes',
          description: 'Faça upgrade para participar de grupos de estudos.',
          variant: 'destructive',
        });
        setTimeout(() => navigate('/planos'), 2000);
      } else if (errorMessage.includes('privado') || errorMessage.includes('convite')) {
        toast({
          title: 'Grupo privado',
          description: 'Este grupo é privado. Apenas membros convidados podem participar.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Erro ao solicitar entrada',
          description: errorMessage || 'Não foi possível enviar o pedido.',
          variant: 'destructive',
        });
      }
    },
  });
}

export function useLeaveGroup() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (groupId: string) => studyGroupMembersService.leaveGroup(groupId, user!.id),
    onSuccess: (_, groupId) => {
      queryClient.invalidateQueries({ queryKey: ['group-members', groupId] });
      queryClient.invalidateQueries({ queryKey: ['study-group', groupId] });
      queryClient.invalidateQueries({ queryKey: ['user-groups', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['user-group-status', groupId, user?.id] });
      toast({
        title: 'Você saiu do grupo',
        description: 'Você não é mais membro deste grupo.',
      });
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : 'Não foi possível sair do grupo.';
      toast({
        title: 'Erro ao sair do grupo',
        description: errorMessage,
        variant: 'destructive',
      });
    },
  });
}

export function useUserGroups(userId: string | undefined) {
  const { data: groups = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['user-groups', userId],
    queryFn: () => studyGroupMembersService.getUserGroups(userId!),
    enabled: !!userId,
  });

  return { groups, isLoading, isError, refetch };
}
