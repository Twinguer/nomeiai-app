
import React from 'react';
import { UserAvatar } from './UserAvatar';

interface UserCardProps {
  id: string;
  name: string;
  avatarUrl?: string | null;
  onClick: (id: string) => void;
}

export const UserCard: React.FC<UserCardProps> = ({ 
  id, 
  name, 
  avatarUrl, 
  onClick 
}) => {
  return (
    <div 
      className="flex flex-col items-center text-center cursor-pointer p-2 w-full"
      onClick={() => onClick(id)}
    >
      <UserAvatar name={name} avatarUrl={avatarUrl} />
      <span className="text-xs mt-1 truncate w-full">{name}</span>
    </div>
  );
};
