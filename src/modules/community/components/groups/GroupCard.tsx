import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Users, GraduationCap, Lock, Globe, UserPlus, MessageSquare, Eye } from 'lucide-react';
import type { StudyGroup } from '../../domain/types';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/hooks/useAuth';
import { usePlanLimits } from '@/modules/payments';
import { useNavigate } from 'react-router-dom';

interface GroupCardProps {
  group: StudyGroup;
  onClick?: (groupId: string) => void;
  showJoinButton?: boolean;
  isMember?: boolean;
  onJoin?: (groupId: string) => void;
}

// Helper para obter iniciais do grupo
const getGroupInitials = (name: string) => {
  if (!name) return 'G';
  return name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);
};

export const GroupCard: React.FC<GroupCardProps> = ({
  group,
  onClick,
  showJoinButton = true,
  isMember = false,
  onJoin,
}) => {
  const { user } = useAuth();
  const { canAccessStudyGroups } = usePlanLimits();
  const navigate = useNavigate();
  const isAuthenticated = !!user;

  const handleCardClick = () => {
    // ✅ Se não estiver autenticado, redirecionar para login
    if (!isAuthenticated) {
      window.location.href = '/auth';
      return;
    }
    
    if (!canAccessStudyGroups) {
      navigate('/planos');
      return;
    }
    
    if (onClick) {
      onClick(group.id);
    }
  };

  const handleJoinClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onJoin) {
      onJoin(group.id);
    }
  };

  const privacyIcon = group.privacy_level === 'public' ? (
    <Globe className="h-4 w-4" />
  ) : (
    <Lock className="h-4 w-4" />
  );

  const timeAgo = group.created_at && !isNaN(new Date(group.created_at).getTime())
    ? formatDistanceToNow(new Date(group.created_at), {
        addSuffix: true,
        locale: ptBR,
      })
    : 'Data não disponível';

  // Contar posts
  const postsCount = group.posts_data?.length || 0;

  return (
    <Card 
      className="rounded-xl border border-border bg-card text-card-foreground shadow-lg overflow-hidden cursor-pointer hover:shadow-xl transition-all duration-300"
      style={{ boxShadow: '0 8px 25px rgba(0, 0, 0, 0.15), 0 4px 10px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.05)' }}
      onClick={handleCardClick}
    >
      <CardContent className="p-5 flex flex-col">
        {/* Avatar e Nome */}
        <div className="flex flex-col items-center mb-4">
          <div className="relative mb-3">
            <Avatar className="h-20 w-20" style={{ boxShadow: '0 8px 20px rgba(0, 0, 0, 0.5), 0 4px 8px rgba(0, 0, 0, 0.4), 0 2px 4px rgba(0, 0, 0, 0.3)' }}>
              {group.cover_image_url ? (
                <AvatarImage src={group.cover_image_url} alt={group.name} />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                  <GraduationCap className="h-10 w-10 text-white" />
                </div>
              )}
              <AvatarFallback className="bg-gradient-to-br from-purple-500 to-blue-500 text-white font-bold text-lg">
                {getGroupInitials(group.name)}
              </AvatarFallback>
            </Avatar>
            <Badge 
              variant={group.privacy_level === 'public' ? 'default' : 'secondary'}
              className="absolute -bottom-1 -right-1"
            >
              {privacyIcon}
            </Badge>
          </div>
          <h3 className="font-semibold text-base text-center leading-tight mb-1">
            {group.name}
          </h3>
          <div className="flex gap-1 flex-wrap justify-center">
            {group.coach_id && (
              <Badge variant="secondary" className="text-xs">
                <UserPlus className="h-3 w-3 mr-1" />
                Com Coach
              </Badge>
            )}
            {group.focus_area && (
              <Badge variant="outline" className="text-xs">
                {group.focus_area}
              </Badge>
            )}
          </div>
        </div>

        {/* ✅ Estatísticas - Mostrar apenas para usuários autenticados */}
        {isAuthenticated && (
          <>
            <div className="grid grid-cols-2 gap-3 mb-4 border-t border-b py-3">
              <div className="flex flex-col items-center">
                <div className="flex items-center gap-1 text-muted-foreground mb-1">
                  <Users className="h-4 w-4" />
                </div>
                <span className="text-lg font-bold text-primary">
                  {group.current_members}
                </span>
                <span className="text-xs text-muted-foreground text-center">
                  {group.max_members ? `de ${group.max_members}` : ''} membros
                </span>
              </div>
              <div className="flex flex-col items-center">
                <div className="flex items-center gap-1 text-muted-foreground mb-1">
                  <MessageSquare className="h-4 w-4" />
                </div>
                <span className="text-lg font-bold text-green-600">
                  {postsCount}
                </span>
                <span className="text-xs text-muted-foreground text-center">
                  Posts
                </span>
              </div>
            </div>

            {/* Data de criação */}
            <div className="mb-4 text-center">
              <p className="text-xs text-muted-foreground">
                Criado {timeAgo}
              </p>
            </div>
          </>
        )}

        {/* Botões de Ação */}
        <div className="flex flex-col gap-2 mt-auto">
          {isAuthenticated ? (
            isMember ? (
              <Button
                variant="default"
                size="sm"
                className="w-full"
                onClick={handleCardClick}
              >
                <Eye className="mr-2 h-4 w-4" />
                Ver Grupo
              </Button>
            ) : showJoinButton ? (
              <Button
                variant="default"
                size="sm"
                className="w-full"
                onClick={handleJoinClick}
              >
                Solicitar Entrada
              </Button>
            ) : null
          ) : (
            <Button
              variant="default"
              size="sm"
              className="w-full"
              onClick={() => window.location.href = '/auth'}
            >
              Fazer Login para Ver
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

