
import React, { ReactNode } from 'react';
import { UserCard } from './UserCard';

interface User {
  id?: string;
  name?: string;
  username?: string;
  followerCount: number;
  postCount: number;
  approvalCount: number;
  status_concurseiro: string;
  email: string;
  bio: string;
  concursos_aprovados: any;
  concursos_participando: any;
  avatar_url: string;
  isCoach?: boolean;
  isPro?: boolean;
  hasActiveCoach?: boolean;
  activeStudentCount?: number;
  is_studying?: boolean;
}

interface UserGridProps {
  children?: ReactNode;
  users?: User[];
  className?: string;
  onClick?: (userId: string) => void;
}

export const UserGrid: React.FC<UserGridProps> = ({ children, users, className = '', onClick }) => {
  return (
    <div className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-6 gap-4 items-stretch ${className}`}>
      {users && users.map((user, index) => {
        // Map the user data to match UserCard's expected interface
        const displayName = user.name?.trim() || user.username?.trim() || user.email.split('@')[0];
        const userProfile = {
          id: user.id || `user-${index}`,
          name: displayName,
          username: user.username,
          avatar_url: user.avatar_url,
          bio: user.bio,
          email: user.email,
          concursos_aprovados: user.concursos_aprovados,
          followerCount: user.followerCount,
          postCount: user.postCount,
          isCoach: user.isCoach || false,
          isPro: user.isPro || false,
          hasActiveCoach: user.hasActiveCoach || false,
          activeStudentCount: user.activeStudentCount ?? 0,
        };
        
        return (
          <UserCard 
            key={user.id || user.email || index} 
            userProfile={userProfile}
            onClick={onClick}
          />
        );
      })}
      {children}
    </div>
  );
};
