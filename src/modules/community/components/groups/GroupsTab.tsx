import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { useStudyGroups } from '../../hooks/useStudyGroups';
import { GroupsGrid } from './GroupsGrid';
import { CreateGroupModal } from './CreateGroupModal';
import { useAuth } from '@/hooks/useAuth';
import { useUserGroups } from '../../hooks/useGroupMembers';
import { useNavigate } from 'react-router-dom';
import { usePlanLimits } from '@/modules/payments';
import { CommunityLoadingState } from '../shared/CommunityLoadingState';
import { CommunityErrorState } from '../shared/CommunityErrorState';

export const GroupsTab: React.FC = () => {
  const { user } = useAuth();
  const { canAccessStudyGroups } = usePlanLimits();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  const { groups, isLoading, isError } = useStudyGroups(searchQuery);
  const { groups: userGroups } = useUserGroups(user?.id);

  const userMemberGroupIds = userGroups.map(g => g.id);

  const handleGroupClick = (groupId: string) => {
    // ✅ Se for usuário free, redirecionar para planos
    if (!canAccessStudyGroups) {
      navigate('/planos');
      return;
    }
    navigate(`/grupos/${groupId}`);
  };

  const handleJoinGroup = (groupId: string) => {
    if (!canAccessStudyGroups) {
      navigate('/planos');
      return;
    }
    // Navegar para a página do grupo (o usuário pode entrar lá)
    navigate(`/grupos/${groupId}`);
  };

  const handleGroupCreated = (groupId: string) => {
    navigate(`/grupos/${groupId}`);
  };

  if (isLoading) return <CommunityLoadingState />;
  if (isError) return <CommunityErrorState />;

  return (
    <div className="space-y-6">
      {/* Header com busca e criar */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-md w-full">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Buscar grupos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        
        {user && (
          <CreateGroupModal onSuccess={handleGroupCreated} />
        )}
      </div>

      {/* Grid de grupos */}
      <GroupsGrid
        groups={groups}
        onClick={handleGroupClick}
        onJoin={user ? handleJoinGroup : undefined}
        userMemberGroupIds={userMemberGroupIds}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4"
      />

      {groups.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">
            {searchQuery ? 'Nenhum grupo encontrado com essa busca.' : 'Ainda não há grupos criados.'}
          </p>
          {user && !searchQuery && (
            <CreateGroupModal onSuccess={handleGroupCreated} />
          )}
        </div>
      )}
    </div>
  );
};

