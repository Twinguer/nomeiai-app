import React from 'react';
import { BarChart3 } from 'lucide-react';

export function StatisticsLoadingState() {
  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <BarChart3 className="mx-auto h-12 w-12 text-muted-foreground mb-4 animate-pulse" />
          <p className="text-muted-foreground">Carregando estatísticas...</p>
        </div>
      </div>
    </div>
  );
}
