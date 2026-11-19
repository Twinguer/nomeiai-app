
import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { OnlineIndicator } from './OnlineIndicator';
import { getAvatarUrl } from '@/utils/avatarUtils';

interface UserAvatarProps {
  name: string;
  avatarUrl?: string | null;
  size?: 'sm' | 'md' | 'lg';
  userId?: string;
  showOnlineStatus?: boolean;
}

export const UserAvatar: React.FC<UserAvatarProps> = ({ 
  name, 
  avatarUrl, 
  size = 'md',
  userId,
  showOnlineStatus = false
}) => {
  const getInitials = (name: string) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  };

  const sizeClass = {
    sm: 'h-6 w-6 sm:h-8 sm:w-8',
    md: 'h-10 w-10 sm:h-12 sm:w-12',
    lg: 'h-14 w-14 sm:h-16 sm:w-16'
  }[size];

  // Truncate name to 15 characters and capitalize properly
  const displayName = name ? 
    name.split(' ').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' ').substring(0, 15) : 'Usuário';

  // Usar avatar padrão se não houver avatar_url
  const displayAvatarUrl = getAvatarUrl(avatarUrl);

  return (
    <div className="relative inline-block">
      <Avatar 
        className={sizeClass}
        style={{ boxShadow: '0 4px 10px rgba(0, 0, 0, 0.3), 0 2px 4px rgba(0, 0, 0, 0.2), 0 1px 2px rgba(0, 0, 0, 0.1)' }}
      >
        <AvatarImage src={displayAvatarUrl} alt={displayName} />
        <AvatarFallback>{getInitials(displayName)}</AvatarFallback>
      </Avatar>
      {showOnlineStatus && userId && (
        <OnlineIndicator userId={userId} />
      )}
    </div>
  );
};
