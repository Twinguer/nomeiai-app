
import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CommunityErrorStateProps {
  handleUserClick?: (userId: string) => void;
}

export const CommunityErrorState: React.FC<CommunityErrorStateProps> = ({ 
  handleUserClick 
}) => {
  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="p-6 bg-red-50 border border-red-100 rounded-lg text-center">
        <div className="flex justify-center mb-4">
          <AlertTriangle className="h-12 w-12 text-red-500" />
        </div>
        <h2 className="text-xl font-bold text-red-800 mb-2">Erro ao carregar usuários</h2>
        <p className="text-red-600 mb-6">
          Ocorreu um problema ao carregar os usuários da comunidade. Tente novamente mais tarde.
        </p>
        <Button onClick={handleRefresh} variant="destructive">
          Tentar novamente
        </Button>
      </div>
    </div>
  );
};
