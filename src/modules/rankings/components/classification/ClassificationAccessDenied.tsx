import type { NavigateFunction } from 'react-router-dom';
import { RankingCard } from '@/modules/rankings/components/classification/RankingCard';
import ConcursoInfoCard from '@/modules/rankings/components/classification/ConcursoInfoCard';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Lock } from 'lucide-react';
import { showProRequiredToast } from '@/utils/planRestrictions';
import { devLog } from '@/utils/productionLogger';
import { UrlObfuscationService } from '@/services/urlObfuscation';
import type { Ranking } from '@/modules/rankings/services/rankingService';
import type { Concurso } from '@/types/concursos';

type ClassificationAccessDeniedProps = {
  concurso: Concurso;
  participantCount: number;
  userRanking: Ranking | null;
  creatorName: string;
  navigate: NavigateFunction;
  onParticipateError: (message: string) => void;
};

async function goToParticipate(
  concursoId: string,
  navigate: NavigateFunction,
  onError: (message: string) => void,
) {
  try {
    const token = await UrlObfuscationService.generateConcursoToken(concursoId);
    navigate(`/concurso/participar/${token}`);
  } catch (error) {
    devLog.error('Erro ao gerar token seguro:', error);
    onError('Não foi possível gerar link seguro. Tente novamente.');
  }
}

export function ClassificationAccessDenied({
  concurso,
  participantCount,
  userRanking,
  creatorName,
  navigate,
  onParticipateError,
}: ClassificationAccessDeniedProps) {
  const handleParticipate = () => goToParticipate(concurso.id, navigate, onParticipateError);

  return (
    <div className="page-content-container">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 gap-3">
        <div className="flex gap-1 sm:gap-2 flex-wrap">
          <Button
            onClick={handleParticipate}
            className="flex items-center gap-2 text-xs sm:text-sm bg-emerald-600 hover:bg-emerald-700"
            size="sm"
          >
            Participar do Ranking
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-1 mb-2">
        <RankingCard
          participantCount={participantCount}
          userRanking={userRanking}
          inscritos={concurso.inscritos}
        />
        <ConcursoInfoCard concurso={concurso} creatorName={creatorName} />
      </div>

      <Alert variant="destructive" className="mt-4">
        <Lock className="h-4 w-4" />
        <AlertTitle>Acesso Restrito</AlertTitle>
        <AlertDescription>
          <p className="mb-2">
            Usuários Free só podem visualizar a classificação de rankings que participam ou criaram.
          </p>
          <p className="mb-3">
            Você pode participar de até <strong>2 rankings que não criou</strong> ou participar de{' '}
            <strong>todos os rankings que criar</strong>.
          </p>
          <div className="flex gap-2 mt-3">
            <Button onClick={handleParticipate} size="sm" className="bg-emerald-600 hover:bg-emerald-700">
              Participar do Ranking
            </Button>
            <Button
              onClick={() => showProRequiredToast(navigate, 'Visualizar Classificações Ilimitadas')}
              size="sm"
              variant="outline"
            >
              Assinar Plano Pro
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    </div>
  );
}
