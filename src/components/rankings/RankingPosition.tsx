import React from 'react';
import { Badge } from '@/components/ui/badge';

interface RankingPositionProps {
  position: number;
  belowMinimum: boolean;
  isEliminated?: boolean;
}

export const RankingPosition: React.FC<RankingPositionProps> = ({
  position,
  belowMinimum,
  isEliminated = false
}) => {
  if (belowMinimum || isEliminated) {
    return (
      <Badge variant="destructive" className="font-bold">
        E
      </Badge>
    );
  }

  return (
    <span className="font-bold text-primary">
      {position}º
    </span>
  );
};