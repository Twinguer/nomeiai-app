import React from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, ChevronDown } from 'lucide-react';

interface LoadMoreButtonProps {
  onLoadMore: () => void;
  isLoading: boolean;
  hasMore: boolean;
  totalLoaded: number;
  className?: string;
}

export const LoadMoreButton: React.FC<LoadMoreButtonProps> = ({
  onLoadMore,
  isLoading,
  hasMore,
  totalLoaded,
  className = ''
}) => {
  if (!hasMore) {
    return (
      <div className={`text-center py-4 ${className}`}>
        <p className="text-sm text-muted-foreground">
          Todos os {totalLoaded} participantes foram carregados
        </p>
      </div>
    );
  }

  return (
    <div className={`text-center py-4 ${className}`}>
      <Button
        onClick={onLoadMore}
        disabled={isLoading}
        variant="outline"
        className="min-w-[200px]"
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Carregando...
          </>
        ) : (
          <>
            <ChevronDown className="h-4 w-4 mr-2" />
            Carregar Mais ({totalLoaded} carregados)
          </>
        )}
      </Button>
    </div>
  );
};
