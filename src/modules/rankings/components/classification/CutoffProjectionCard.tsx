import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatScore } from '@/lib/utils';
import { Target } from 'lucide-react';
import { useCutoffProjection } from '@/modules/rankings/hooks/useCutoffProjection';
import { Concurso } from '@/types/concursos';

interface CutoffProjectionCardProps {
  concurso: Concurso;
}

export function CutoffProjectionCard({ concurso }: CutoffProjectionCardProps) {
  const { data, isLoading, isError } = useCutoffProjection(concurso.id, Boolean(concurso.vagas));

  if (!concurso.vagas || concurso.vagas <= 0) {
    return null;
  }

  const isProvisional = data?.is_provisional ?? concurso.gabarito_status === 'consensus';

  return (
    <Card className="my-1 dark:border-primary/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          Nota de corte projetada
          <Badge variant="outline" className="text-xs font-normal">
            Ampla concorrência
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 pb-4 space-y-2">
        {isLoading && (
          <p className="text-sm text-muted-foreground">Calculando projeção...</p>
        )}

        {isError && (
          <p className="text-sm text-muted-foreground">Não foi possível calcular a nota de corte.</p>
        )}

        {!isLoading && !isError && data?.success && (
          <>
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-2xl font-semibold text-primary">
                {data.cutoff_score != null ? formatScore(Number(data.cutoff_score)) : '—'}
              </span>
              <span className="text-sm text-muted-foreground">
                para {data.vagas} vaga{data.vagas !== 1 ? 's' : ''}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {data.classified_ampla_count ?? 0} classificado
              {(data.classified_ampla_count ?? 0) !== 1 ? 's' : ''} na ampla
              {!data.has_enough_candidates && ' (ainda insuficientes para preencher todas as vagas)'}
              {isProvisional && ' · Projeção baseada em gabarito provisório'}
            </p>
          </>
        )}

        {!isLoading && !isError && data && !data.success && (
          <p className="text-sm text-muted-foreground">{data.message ?? 'Dados insuficientes.'}</p>
        )}
      </CardContent>
    </Card>
  );
}
