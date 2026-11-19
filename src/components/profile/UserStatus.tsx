import React from 'react';
import { Badge } from '@/components/ui/badge';

interface UserStatusProps {
  isClassified: boolean;
  belowMinimum: boolean;
}

export const UserStatus: React.FC<UserStatusProps> = ({
  isClassified,
  belowMinimum
}) => {
  if (belowMinimum || !isClassified) {
    return (
      <Badge variant="destructive">
        Eliminado
      </Badge>
    );
  }

  return (
    <Badge variant="outline">
      Classificado
    </Badge>
  );
};