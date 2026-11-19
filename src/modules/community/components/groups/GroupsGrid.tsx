import React from 'react';
import { GroupCard } from './GroupCard';
import type { StudyGroup } from '../../domain/types';

interface GroupsGridProps {
  groups: StudyGroup[];
  onClick?: (groupId: string) => void;
  onJoin?: (groupId: string) => void;
  userMemberGroupIds?: string[];
  className?: string;
}

export const GroupsGrid: React.FC<GroupsGridProps> = ({
  groups,
  onClick,
  onJoin,
  userMemberGroupIds = [],
  className = '',
}) => {
  if (groups.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Nenhum grupo encontrado.</p>
      </div>
    );
  }

  const defaultGridClasses = "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2";
  const gridClasses = className || defaultGridClasses;

  return (
    <div className={gridClasses}>
      {groups.map((group) => (
        <GroupCard
          key={group.id}
          group={group}
          onClick={onClick}
          showJoinButton={!!onJoin}
          isMember={userMemberGroupIds.includes(group.id)}
          onJoin={onJoin}
        />
      ))}
    </div>
  );
};

