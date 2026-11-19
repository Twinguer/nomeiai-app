import React from 'react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Trash2, Eye } from 'lucide-react';

interface RankingActionsProps {
  onLeave?: () => void;
  onView?: () => void;
  showLeaveAction?: boolean;
  showViewAction?: boolean;
  isLeaving?: boolean;
}

export const RankingActions: React.FC<RankingActionsProps> = ({
  onLeave,
  onView,
  showLeaveAction = false,
  showViewAction = true,
  isLeaving = false
}) => {
  return (
    <div className="flex gap-2">
      {showViewAction && onView && (
        <Button onClick={onView} variant="outline" size="sm">
          <Eye className="h-4 w-4 mr-1" />
          Ver
        </Button>
      )}
      
      {showLeaveAction && onLeave && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button 
              variant="destructive" 
              size="sm"
              disabled={isLeaving}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              {isLeaving ? 'Saindo...' : 'Deixar de Participar'}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar saída</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja deixar de participar deste ranking? 
                Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={onLeave}>
                Sim, deixar de participar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
};