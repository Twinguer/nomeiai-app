import React from 'react';
import { usePresence } from '@/contexts/PresenceContext';

interface OnlineIndicatorProps {
  userId: string;
  className?: string;
}

export const OnlineIndicator: React.FC<OnlineIndicatorProps> = ({ userId, className = '' }) => {
  const { isOnline } = usePresence();
  const online = isOnline(userId);

  const ringClasses = `absolute inset-0 rounded-full ring-2 ring-offset-2 ring-offset-background ${online ? 'ring-green-500' : 'ring-transparent'} pointer-events-none z-10 ${className}`;

  return (
    <div
      className={ringClasses}
      title={online ? 'Online' : 'Offline'}
      aria-label={online ? 'Online' : 'Offline'}
    />
  );
};

export default OnlineIndicator;
