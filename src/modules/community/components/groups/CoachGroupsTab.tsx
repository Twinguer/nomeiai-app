import React from 'react';
import { GroupsGrid } from './GroupsGrid';
import { CreateGroupModal } from './CreateGroupModal';
import { useUserGroups } from '../../hooks/useGroupMembers';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { CommunityLoadingState } from '../shared/CommunityLoadingState';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { GraduationCap, Plus } from 'lucide-react';

export const CoachGroupsTab: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { groups, isLoading } = useUserGroups(user?.id);

  const handleGroupClick = (groupId: string) => {
    navigate(`/grupos/${groupId}`);
  };

  const handleGroupCreated = (groupId: string) => {
    navigate(`/grupos/${groupId}`);
  };

  if (isLoading) return <CommunityLoadingState />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Grupos de Estudos</h2>
          <p className="text-muted-foreground">
            Crie grupos para seus alunos ou participe de grupos públicos
          </p>
        </div>
        <CreateGroupModal onSuccess={handleGroupCreated} />
      </div>

      {/* Grupos criados pelo coach */}
      {groups.length > 0 ? (
        <GroupsGrid
          groups={groups}
          onClick={handleGroupClick}
          userMemberGroupIds={groups.map(g => g.id)}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4"
        />
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <GraduationCap className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <CardTitle className="mb-2">Nenhum grupo ainda</CardTitle>
            <CardDescription className="mb-4">
              Crie grupos para organizar seus alunos por concurso ou área de estudo
            </CardDescription>
            <CreateGroupModal onSuccess={handleGroupCreated} />
          </CardContent>
        </Card>
      )}

      {/* Link para ver todos os grupos */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Explorar Grupos Públicos</CardTitle>
              <CardDescription>
                Veja todos os grupos disponíveis na comunidade
              </CardDescription>
            </div>
            <button
              onClick={() => navigate('/comunidade?tab=grupos')}
              className="text-primary hover:underline text-sm font-medium"
            >
              Ver todos →
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

