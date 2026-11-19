import type { NavigateFunction } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { RefreshCw, UserPlus, LogIn, UserMinus, Loader2 } from 'lucide-react';
import { devLog } from '@/utils/productionLogger';
import { UrlObfuscationService } from '@/services/urlObfuscation';
import type { Concurso } from '@/types/concursos';

type ResultadosToolbarProps = {
  concurso: Concurso | null | undefined;
  user: { id: string } | null | undefined;
  isParticipating: boolean;
  isRefetching: boolean;
  isRecalculating: boolean;
  isRefreshing: boolean;
  recalculationProgress: { current: number; total: number } | null;
  isLeaving: boolean;
  navigate: NavigateFunction;
  onRefresh: () => void;
  onLeaveClick: () => void;
  onParticipateError: (message: string) => void;
};

export function ResultadosToolbar({
  concurso,
  user,
  isParticipating,
  isRefetching,
  isRecalculating,
  isRefreshing,
  recalculationProgress,
  isLeaving,
  navigate,
  onRefresh,
  onLeaveClick,
  onParticipateError,
}: ResultadosToolbarProps) {
  const handleParticipate = async () => {
    if (!concurso?.id) return;
    try {
      const token = await UrlObfuscationService.generateConcursoToken(concurso.id);
      navigate(`/concurso/participar/${token}`);
    } catch (error) {
      devLog.error('Erro ao gerar token seguro:', error);
      onParticipateError('Não foi possível gerar link seguro. Tente novamente.');
    }
  };

  return (
    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 gap-3">
      <div className="flex gap-1 sm:gap-2 flex-wrap">
        <Button
          onClick={onRefresh}
          className="flex items-center gap-2 text-xs sm:text-sm"
          size="sm"
          disabled={isRefetching || isRecalculating || isRefreshing}
          variant="outline"
        >
          {isRecalculating ? (
            <>
              <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
              Recalculando... {recalculationProgress?.current}/{recalculationProgress?.total}
            </>
          ) : isRefetching || isRefreshing ? (
            <>
              <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
              Atualizando...
            </>
          ) : (
            <>
              <RefreshCw className="h-3 w-3 sm:h-4 sm:w-4" />
              Atualizar Classificação
            </>
          )}
        </Button>

        {concurso && !isParticipating && user && !concurso.is_showcase && (
          <Button
            onClick={handleParticipate}
            className="flex items-center gap-2 text-xs sm:text-sm bg-emerald-600 hover:bg-emerald-700"
            size="sm"
          >
            <UserPlus className="h-3 w-3 sm:h-4 sm:w-4" />
            Participar
          </Button>
        )}

        {concurso && isParticipating && user && (
          <Button
            onClick={onLeaveClick}
            variant="destructive"
            className="flex items-center gap-2 text-xs sm:text-sm"
            size="sm"
            disabled={isLeaving}
          >
            <UserMinus className="h-3 w-3 sm:h-4 sm:w-4" />
            Deixar Ranking
          </Button>
        )}

        {concurso && !user && (
          <Button
            onClick={() => navigate('/auth')}
            className="flex items-center gap-2 text-xs sm:text-sm"
            size="sm"
          >
            <LogIn className="h-3 w-3 sm:h-4 sm:w-4" />
            Login
          </Button>
        )}
      </div>
    </div>
  );
}
