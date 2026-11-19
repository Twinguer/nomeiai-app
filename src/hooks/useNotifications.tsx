import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from '@/hooks/use-toast';
import { logError } from '@/utils/secureLogger';

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  metadata: any;
  is_read: boolean;
  created_at: string;
}

// Hook para modal de convite do coach
export const useCoachInvitation = () => {
  const [activeInvitation, setActiveInvitation] = useState<Notification | null>(null);

  const openInvitation = (notification: Notification) => {
    if (notification.type === 'coach_invitation') {
      setActiveInvitation(notification);
    }
  };

  const closeInvitation = () => {
    setActiveInvitation(null);
  };

  return { activeInvitation, openInvitation, closeInvitation };
};

export const useNotifications = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Buscar notificações do usuário
  const {
    data: notifications = [],
    isLoading,
    refetch
  } = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      // Aguardar um pouco para garantir que a sessão está totalmente carregada
      // Isso resolve o problema de convites desaparecendo após refresh
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Para notificações de convite, verificar se o convite ainda existe
      // e está pendente antes de exibir
      const notificationsWithValidInvitations = await Promise.all(
        (data || []).map(async (notification) => {
          if (notification.type === 'coach_invitation') {
            const invitationId = notification.metadata?.invitation_id || notification.metadata?.invitationId;
            if (invitationId) {
              try {
                // Verificar se o convite ainda existe e está pendente
                const { data: invitation, error: invitationError } = await supabase
                  .from('coach_invitations_history')
                  .select('id, status')
                  .eq('id', invitationId)
                  .eq('status', 'pending')
                  .maybeSingle();
                
                // Se o convite não existe mais ou não está pendente, não exibir a notificação
                if (invitationError || !invitation) {
                  return null;
                }
              } catch (err) {
                // Se houver erro ao verificar (ex: RLS), ainda exibir a notificação
                // para não perder o convite caso seja um problema temporário
                console.warn('Erro ao verificar convite:', err);
              }
            }
          }
          return notification;
        })
      );
      
      // Filtrar nulls (convites inválidos)
      return notificationsWithValidInvitations.filter(n => n !== null) as Notification[];
    },
    enabled: !!user?.id,
    retry: 2, // Tentar novamente em caso de erro
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000), // Backoff exponencial
  });

  // Contar notificações não lidas
  const unreadCount = notifications.filter(n => !n.is_read).length;

  // Marcar notificação como lida (deletar após marcar como lida)
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      // Deletar a notificação em vez de apenas marcar como lida
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (error) => {
      logError('Error marking notification as read', error, 'NOTIFICATIONS');
      toast({
        title: "Erro",
        description: "Não foi possível marcar a notificação como lida",
        variant: "destructive",
      });
    },
  });

  // Marcar todas como lidas (deletar todas após marcar como lidas)
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) return;
      
      // Deletar todas as notificações não lidas em vez de apenas marcar como lidas
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('user_id', user.id)
        .eq('is_read', false);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast({
        title: "Sucesso",
        description: "Todas as notificações foram removidas",
      });
    },
    onError: (error) => {
      logError('Error marking all notifications as read', error, 'NOTIFICATIONS');
      toast({
        title: "Erro",
        description: "Não foi possível marcar todas as notificações como lidas",
        variant: "destructive",
      });
    },
  });

  // Escutar notificações em tempo real
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ['notifications'] });
          
          // Mostrar toast para nova notificação
          const notification = payload.new as Notification;
          toast({
            title: notification.title,
            description: notification.message,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  return {
    notifications,
    unreadCount,
    isLoading,
    markAsRead: markAsReadMutation.mutate,
    markAllAsRead: markAllAsReadMutation.mutate,
    refetch,
  };
};