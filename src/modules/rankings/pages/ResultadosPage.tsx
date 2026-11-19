// @ts-nocheck

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { RankingCard } from '@/modules/rankings/components/classification/RankingCard';
import ConcursoInfoCard from '@/modules/rankings/components/classification/ConcursoInfoCard';
import { RankingTable } from '@/modules/rankings/components/classification/RankingTable';
import { LoadingState } from '@/modules/rankings/components/classification/LoadingState';
import { useResultadosData } from '@/modules/rankings/hooks/useResultadosData';
import { useLeaveRanking } from '@/modules/rankings/hooks/useLeaveRanking';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useSubscription } from '@/modules/payments';
import { logger } from '@/utils/logger';
import { rankingCache } from '@/modules/rankings/services/rankingCache';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Info } from 'lucide-react';
import { useClassificationAccess } from '@/modules/rankings/hooks/useClassificationAccess';
import { ClassificationAccessDenied } from '@/modules/rankings/components/classification/ClassificationAccessDenied';
import { ResultadosToolbar } from '@/modules/rankings/components/classification/ResultadosToolbar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface ResultadosPageProps {
  rankingId?: string;
  concursoId?: string;
  secureToken?: string;
}

const ResultadosPage = ({ rankingId, concursoId, secureToken }: ResultadosPageProps = {}) => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const { isPro, isLoading: isSubscriptionLoading } = useSubscription();
  const { toast } = useToast();

  const finalRankingId = rankingId || concursoId || id;
  const isLegacyRouteAccess = Boolean(id && !secureToken && !rankingId && !concursoId);
  const safeRankingId = isLegacyRouteAccess ? undefined : finalRankingId;

  const {
    concurso,
    rankings,
    participantCount,
    userRanking,
    isLoading: isLoadingConcurso,
    isRefetching,
    user,
    refreshData,
    creatorName,
    isParticipating,
    isRecalculating,
    recalculationProgress,
  } = useResultadosData(safeRankingId, { allowUrlFallback: !isLegacyRouteAccess });

  const { canViewRanking, isCheckingAccess } = useClassificationAccess({
    concurso,
    user,
    isPro,
    isParticipating,
    isProLoading: isSubscriptionLoading,
  });

  const paginatedRankings = rankings;
  const isLoadingRankings = isLoadingConcurso;
  const { leave, isLeaving } = useLeaveRanking();
  const isAuthenticated = !!user;
  const isLoading = isLoadingConcurso || isLoadingRankings;

  const showParticipateError = (description: string) => {
    toast({ title: 'Erro', description, variant: 'destructive' });
  };

  if (isLegacyRouteAccess) {
    return (
      <div className="p-6 rounded-lg shadow-sm border border-border bg-muted/30">
        <Alert variant="destructive">
          <AlertTitle>Acesso bloqueado</AlertTitle>
          <AlertDescription>
            Para visualizar rankings é necessário utilizar um link seguro com token válido. Esse caminho
            não está mais disponível por motivos de segurança.
          </AlertDescription>
        </Alert>
        <Button
          className="mt-4 bg-emerald-600 hover:bg-emerald-700"
          onClick={() => navigate('/pre-classificacao')}
        >
          Voltar para pré-classificação
        </Button>
      </div>
    );
  }

  useEffect(() => {
    logger.info('ResultadosPage debug', 'RESULTADOS_PAGE', {
      finalRankingId,
      paginatedRankingsLength: paginatedRankings.length,
      isLoadingRankings,
    });
  }, [finalRankingId, paginatedRankings.length, isLoadingRankings]);

  useEffect(() => {
    if (concurso) {
      logger.info('Concurso data loaded', 'RESULTADOS_PAGE', {
        concursoId: concurso.id,
        titulo: concurso.titulo,
      });
    }
  }, [concurso, paginatedRankings, isAuthenticated, isParticipating, userRanking]);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState(0);

  const handleRefresh = async () => {
    const now = Date.now();
    const timeSinceLastRefresh = now - lastRefreshTime;

    if (isRefreshing || timeSinceLastRefresh < 3000) {
      toast({
        title: 'Aguarde',
        description: 'Recálculo já em andamento. Aguarde alguns segundos.',
        variant: 'destructive',
        duration: 2000,
      });
      return;
    }

    setIsRefreshing(true);
    setLastRefreshTime(now);

    logger.info('Manual refresh initiated by user for classification', 'RESULTADOS_PAGE');

    try {
      rankingCache.clear();
      const result = await refreshData();

      if (result?.error) {
        toast({
          title: 'Erro na atualização',
          description: `Houve um problema ao atualizar: ${result.error}`,
          variant: 'destructive',
          duration: 5000,
        });
        return;
      }

      const participantsInfo = result?.participantsRecalculated
        ? ` (${result.participantsRecalculated} participantes recalculados)`
        : '';

      toast({
        title: 'Classificação atualizada',
        description: `Os dados da classificação foram atualizados com sucesso${participantsInfo}.`,
        duration: 3000,
      });
    } catch (error) {
      logger.error('Error during refresh', 'RESULTADOS_PAGE', error);
      toast({
        title: 'Erro na atualização',
        description: 'Ocorreu um erro inesperado ao atualizar a classificação.',
        variant: 'destructive',
        duration: 5000,
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleLeaveRanking = () => {
    if (!concurso) return;
    leave(concurso.id, {
      onSuccess: () => {
        setShowLeaveDialog(false);
        refreshData();
      },
    });
  };

  if (isLoading || isCheckingAccess || (user && isSubscriptionLoading)) {
    return <LoadingState />;
  }

  if (canViewRanking === false && user && !concurso?.is_showcase && concurso) {
    return (
      <ClassificationAccessDenied
        concurso={concurso}
        participantCount={participantCount}
        userRanking={userRanking}
        creatorName={creatorName}
        navigate={navigate}
        onParticipateError={showParticipateError}
      />
    );
  }

  return (
    <div className="page-content-container">
      <ResultadosToolbar
        concurso={concurso}
        user={user}
        isParticipating={isParticipating}
        isRefetching={isRefetching}
        isRecalculating={isRecalculating}
        isRefreshing={isRefreshing}
        recalculationProgress={recalculationProgress}
        isLeaving={isLeaving}
        navigate={navigate}
        onRefresh={handleRefresh}
        onLeaveClick={() => setShowLeaveDialog(true)}
        onParticipateError={showParticipateError}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-1 mb-2">
        <RankingCard
          participantCount={participantCount}
          userRanking={userRanking}
          inscritos={concurso?.inscritos}
        />
        {concurso && <ConcursoInfoCard concurso={concurso} creatorName={creatorName} />}
      </div>

      <RankingTable
        rankings={paginatedRankings}
        concurso={concurso}
        currentUserId={user?.id}
        isAuthenticated={isAuthenticated}
        isRefetching={isRefetching}
      />

      {concurso?.is_showcase === true && (
        <Alert className="mt-1 sm:mt-2">
          <Info className="h-4 w-4" />
          <AlertTitle>Modo Vitrine</AlertTitle>
          <AlertDescription>
            Este ranking está em modo demonstração. Você pode visualizar os resultados, mas novos cadastros
            não são permitidos.
          </AlertDescription>
        </Alert>
      )}

      {!isAuthenticated && !concurso?.is_showcase && (
        <div className="mt-1 sm:mt-2 bg-secondary/50 p-3 rounded-lg border border-border text-sm">
          <p className="text-center text-muted-foreground">
            Para participar deste ranking e comparar seu desempenho, faça login ou crie uma conta.
          </p>
        </div>
      )}

      <AlertDialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sair do Ranking?</AlertDialogTitle>
            <AlertDialogDescription>
              Você tem certeza que deseja sair deste ranking? Todas as suas respostas e pontuações serão
              permanentemente removidas. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleLeaveRanking} className="bg-destructive hover:bg-destructive/90">
              {isLeaving ? 'Saindo...' : 'Sair do Ranking'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ResultadosPage;
