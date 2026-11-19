import React from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent } from '@/components/ui/card';
import { Concurso } from '@/types/concursos';
import { Calendar, MapPin, Users } from 'lucide-react';
import { formatScore } from '@/lib/utils';
import { useCutoffProjection } from '@/modules/rankings/hooks/useCutoffProjection';

interface ConcursoInfoCardProps {
  concurso: Concurso;
  creatorName?: string;
}

function getGabaritoTypeLabel(status?: Concurso['gabarito_status']): string {
  switch (status ?? 'consensus') {
    case 'final':
      return 'Definitivo';
    case 'preliminary':
      return 'Provisório';
    default:
      return 'Consenso';
  }
}

function getCutoffDisplay(
  hasVagas: boolean,
  isLoading: boolean,
  isError: boolean,
  cutoffData: ReturnType<typeof useCutoffProjection>['data']
): string {
  if (!hasVagas) return '—';
  if (isLoading) return '...';
  if (isError || !cutoffData?.success) return '—';
  if (cutoffData.cutoff_score == null) return '—';
  return formatScore(Number(cutoffData.cutoff_score));
}

const ConcursoInfoCard: React.FC<ConcursoInfoCardProps> = ({ concurso, creatorName }) => {
  const formattedDate = concurso.created_at
    ? format(new Date(concurso.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
    : 'Data não informada';

  const hasVagas = Boolean(concurso.vagas && concurso.vagas > 0);
  const { data: cutoffData, isLoading: isLoadingCutoff, isError: isCutoffError } = useCutoffProjection(
    concurso.id,
    hasVagas
  );

  const getLocalidadesText = () => {
    if (concurso.is_unified && concurso.state_uf) {
      return concurso.state_uf;
    }

    if (concurso.parent_concurso_id && concurso.state_uf) {
      return concurso.state_uf;
    }

    if (!concurso.localidades || !Array.isArray(concurso.localidades) || concurso.localidades.length === 0) {
      return 'Não informado';
    }
    if (concurso.localidades.includes('Nacional')) {
      return 'Nacional';
    }

    if (concurso.localidades.length > 3) {
      return `${concurso.localidades.slice(0, 3).join(', ')} e outras`;
    }
    return concurso.localidades.join(', ');
  };

  return (
    <Card className="my-1 dark:border-primary/20">
      <CardContent className="pt-6 py-[15px]">
        <div className="grid gap-4">
          <div>
            <h2 className="text-lg sm:text-xl font-semibold">{concurso.titulo}</h2>
            <p className="text-muted-foreground">{concurso.cargo || concurso.orgao}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="flex items-center">
                <Calendar className="h-4 w-4 mr-2 shrink-0 text-muted-foreground" />
                <span className="text-sm">Data: {formattedDate}</span>
              </div>

              <div className="flex items-center">
                <MapPin className="h-4 w-4 mr-2 shrink-0 text-muted-foreground" />
                <span className="text-sm">Localidade: {getLocalidadesText()}</span>
              </div>

              <div className="flex items-center">
                <Users className="h-4 w-4 mr-2 shrink-0 text-muted-foreground" />
                <span className="text-sm">Vagas: {concurso.vagas ?? 'Não informado'}</span>
              </div>
            </div>

            <div className="flex flex-col justify-center gap-2 md:items-end md:text-right">
              <div className="text-xs text-muted-foreground">
                <span className="block sm:inline">Criado por: </span>
                <span className="font-medium text-foreground">
                  {creatorName || (concurso.is_admin_created ? 'Administrador' : 'Usuário')}
                </span>
              </div>
              <div className="font-mono text-sm font-semibold text-primary">
                {concurso.banca || concurso.custom_banca || 'N/A'}
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-border space-y-1 text-sm">
            <p>
              Gabarito: <span className="font-medium">{getGabaritoTypeLabel(concurso.gabarito_status)}</span>
            </p>
            <p>
              Nota de corte prevista:{' '}
              <span className="font-medium">
                {getCutoffDisplay(hasVagas, isLoadingCutoff, isCutoffError, cutoffData)}
              </span>
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ConcursoInfoCard;
