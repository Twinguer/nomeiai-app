import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Bell, Check, CheckCheck, User, Users, Trophy, Shield, AtSign } from 'lucide-react';
import { useNotifications, useCoachInvitation, Notification } from '@/hooks/useNotifications';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import CoachInvitationModal from '@/components/Coach/CoachInvitationModal';

const NotificationIcon = ({ type }: { type: string }) => {
  switch (type) {
    case 'new_participant':
      return <User className="h-5 w-5 text-notification-info" />;
    case 'admin_broadcast':
      return <Users className="h-5 w-5 text-notification-info" />;
    case 'admin_ranking':
      return <Trophy className="h-5 w-5 text-notification-success" />;
    case 'admin_direct':
      return <Bell className="h-5 w-5 text-notification-warning" />;
    case 'group_mention':
      return <AtSign className="h-5 w-5 text-primary" />;
    default:
      return <Bell className="h-5 w-5 text-notification-muted" />;
  }
};

const NotificationCard = ({ 
  notification, 
  onMarkAsRead,
  onClick
}: { 
  notification: Notification;
  onMarkAsRead: (id: string) => void;
  onClick?: () => void;
}) => {
  const timeAgo = formatDistanceToNow(new Date(notification.created_at), {
    addSuffix: true,
    locale: ptBR,
  });

  const isClickable =
    notification.type === 'coach_invitation' || notification.type === 'group_mention';

  const handleClick = () => {
    if (isClickable && onClick) {
      onClick();
    }
  };

  return (
    <Card 
      className={`transition-all duration-200 ${
        isClickable ? 'cursor-pointer hover:shadow-md' : 'cursor-default'
      } ${
        notification.is_read 
          ? 'bg-background border-border' 
          : 'bg-primary/5 border-primary/20 shadow-sm'
      }`}
      onClick={handleClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-1">
            {notification.type === 'coach_invitation' ? (
              <Shield className="h-5 w-5 text-primary" />
            ) : (
              <NotificationIcon type={notification.type} />
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-medium text-foreground truncate">
                {notification.title}
              </h3>
              {!notification.is_read && (
                <Badge variant="default" className="ml-2">
                  Nova
                </Badge>
              )}
            </div>
            
            <p className="text-sm text-muted-foreground mb-2">
              {notification.message}
            </p>
            
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {timeAgo}
              </span>
              
              {isClickable && !notification.is_read && (
                <Badge variant="outline" className="text-primary border-primary">
                  Clique para ver
                </Badge>
              )}
              
              {!notification.is_read && !isClickable && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onMarkAsRead(notification.id);
                  }}
                  className="h-7 px-2 text-xs"
                >
                  <Check className="h-3 w-3 mr-1" />
                  Marcar como lida
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { 
    notifications, 
    unreadCount, 
    isLoading, 
    markAsRead, 
    markAllAsRead 
  } = useNotifications();

  const { activeInvitation, openInvitation, closeInvitation } = useCoachInvitation();

  const handleNotificationClick = (notification: Notification) => {
    if (notification.type === 'coach_invitation') {
      openInvitation(notification);
      return;
    }

    if (notification.type === 'group_mention') {
      const groupId = notification.metadata?.group_id;
      if (groupId) {
        if (!notification.is_read) {
          markAsRead(notification.id);
        }
        navigate(`/grupos/${groupId}`);
      }
    }
  };

  // activeInvitation é gerenciado pelo hook useCoachInvitation

  if (isLoading) {
    return (
      <div className="min-h-screen bg-page-background">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Carregando notificações...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-page-background">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Notificações</h1>
              {unreadCount > 0 && (
                <p className="text-sm text-muted-foreground mt-1">
                  {unreadCount} notificação{unreadCount !== 1 ? 's' : ''} não lida{unreadCount !== 1 ? 's' : ''}
                </p>
              )}
            </div>
            
            {unreadCount > 0 && (
              <Button
                variant="outline"
                onClick={() => markAllAsRead()}
                className="text-sm"
              >
                <CheckCheck className="h-4 w-4 mr-2" />
                Marcar todas como lidas
              </Button>
            )}
          </div>

          {notifications.length === 0 ? (
            <Card>
              <CardContent className="p-8">
                <div className="text-center">
                  <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2">
                    Nenhuma notificação
                  </h3>
                  <p className="text-muted-foreground">
                    Você não possui notificações no momento.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {notifications.map((notification) => (
                <NotificationCard
                  key={notification.id}
                  notification={notification}
                  onMarkAsRead={markAsRead}
                  onClick={() => handleNotificationClick(notification)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal de convite do coach */}
      {activeInvitation && (
        <CoachInvitationModal
          invitation={activeInvitation}
          onClose={() => {
            closeInvitation();
            // ✅ NÃO marcar como lida ao fechar - apenas quando aceitar/recusar
            // A notificação será removida automaticamente quando o convite for respondido
          }}
        />
      )}
    </div>
  );
}