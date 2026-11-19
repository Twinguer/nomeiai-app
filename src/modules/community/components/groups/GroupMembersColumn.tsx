import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, Crown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSecureUserUrls } from '@/services/userUrlObfuscation';
import type { GroupMember } from '../../domain/types';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { getAvatarUrl } from '@/utils/avatarUtils';

interface GroupMembersColumnProps {
  groupId: string;
  createdBy: string;
  members: GroupMember[];
  isLoading: boolean;
}

export const GroupMembersColumn: React.FC<GroupMembersColumnProps> = ({
  groupId,
  createdBy,
  members,
  isLoading,
}) => {
  const navigate = useNavigate();
  const { generateSecureUserUrl } = useSecureUserUrls();

  // Buscar dados do criador
  const { data: creatorProfile } = useQuery({
    queryKey: ['group-creator', createdBy],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users_profiles')
        .select('id, name, avatar_url')
        .eq('id', createdBy)
        .single();

      if (error) return null;
      return data;
    },
    enabled: !!createdBy,
  });

  const handleViewProfile = async (userId: string) => {
    try {
      const secureUrl = await generateSecureUserUrl(userId, 'profile');
      navigate(secureUrl);
    } catch (error) {
      // Erro silencioso - redirecionar para comunidade
      navigate('/comunidade');
    }
  };

  const getInitials = (name?: string) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  };

  // Filtrar membros ativos (não incluir o criador na lista de integrantes)
  const activeMembers = members.filter(m => 
    m.status === 'active' && (m.user_id !== createdBy || m.id !== createdBy)
  );

  // Mostrar apenas os primeiros 6 integrantes
  const displayMembers = activeMembers.slice(0, 6);

  return (
    <div className="space-y-4">
      {/* Card do Criador */}
      <Card className="rounded-xl border border-border bg-card text-card-foreground shadow-lg hover:shadow-2xl transition-shadow duration-300 overflow-hidden" style={{ boxShadow: '0 8px 25px rgba(0, 0, 0, 0.15), 0 4px 10px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.05)' }}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Crown className="h-4 w-4 text-yellow-500" />
            Criador do Grupo
          </CardTitle>
        </CardHeader>
        <CardContent>
          {creatorProfile ? (
            <div className="flex flex-col items-center text-center">
              <Avatar 
                className="h-16 w-16 mx-auto mb-2 cursor-pointer" 
                style={{ boxShadow: '0 4px 10px rgba(0, 0, 0, 0.3), 0 2px 4px rgba(0, 0, 0, 0.2), 0 1px 2px rgba(0, 0, 0, 0.1)' }}
                onClick={() => handleViewProfile(creatorProfile.id)}
              >
                <AvatarImage src={getAvatarUrl(creatorProfile.avatar_url)} alt={creatorProfile.name} />
                <AvatarFallback className="text-base">
                  {getInitials(creatorProfile.name)}
                </AvatarFallback>
              </Avatar>
              <p className="font-medium text-sm mb-1">{creatorProfile.name}</p>
              <Badge variant="secondary" className="text-xs">
                Criador
              </Badge>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center">Carregando...</p>
          )}
        </CardContent>
      </Card>

      {/* Card dos Integrantes */}
      <Card className="rounded-xl border border-border bg-card text-card-foreground shadow-lg hover:shadow-2xl transition-shadow duration-300 overflow-hidden" style={{ boxShadow: '0 8px 25px rgba(0, 0, 0, 0.15), 0 4px 10px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.05)' }}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Integrantes ({activeMembers.length + 1})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-4">
              <div className="animate-spin h-5 w-5 border-2 border-primary rounded-full border-t-transparent mx-auto"></div>
            </div>
          ) : displayMembers.length > 0 ? (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                {displayMembers.map((member) => {
                  const userId = member.user_id || member.id;
                  return (
                    <div key={member.id} className="text-center">
                      <Avatar 
                        className="h-12 w-12 mx-auto mb-1 cursor-pointer" 
                        style={{ boxShadow: '0 4px 10px rgba(0, 0, 0, 0.3), 0 2px 4px rgba(0, 0, 0, 0.2), 0 1px 2px rgba(0, 0, 0, 0.1)' }}
                        onClick={() => userId && handleViewProfile(userId)}
                      >
                        <AvatarImage src={getAvatarUrl(member.avatar_url)} alt={member.name} />
                        <AvatarFallback className="text-xs">
                          {getInitials(member.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-xs text-muted-foreground truncate block">
                        {member.name?.split(' ')[0]}
                      </span>
                      {member.role !== 'member' && (
                        <Badge variant="outline" className="text-xs mt-1">
                          {member.role === 'admin' ? 'Admin' : 
                           member.role === 'coach' ? 'Coach' : 'Mod'}
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
              {activeMembers.length > 6 && (
                <Button 
                  variant="link" 
                  size="sm" 
                  className="w-full" 
                  onClick={() => navigate(`/grupos/${groupId}/membros`)}
                >
                  Ver todos
                </Button>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center">
              Nenhum integrante ainda
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

