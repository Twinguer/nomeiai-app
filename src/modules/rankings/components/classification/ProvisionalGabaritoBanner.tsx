import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Concurso } from '@/types/concursos';
import { AlertTriangle } from 'lucide-react';

interface ProvisionalGabaritoBannerProps {
  concurso: Concurso;
}

export function ProvisionalGabaritoBanner({ concurso }: ProvisionalGabaritoBannerProps) {
  const status = concurso.gabarito_status ?? 'consensus';

  if (status === 'final') {
    return null;
  }

  const isConsensus = status === 'consensus';
  const isPreliminary = status === 'preliminary';

  if (!isConsensus && !isPreliminary) {
    return null;
  }

  return (
    <Alert className="mb-2 border-amber-500/40 bg-amber-50/80 dark:bg-amber-950/20">
      <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
      <AlertTitle className="text-amber-900 dark:text-amber-100">
        {isConsensus ? 'Ranking provisório por consenso' : 'Gabarito preliminar da banca'}
      </AlertTitle>
      <AlertDescription className="text-amber-800/90 dark:text-amber-200/90">
        {isConsensus ? (
          <>
            As notas usam o gabarito mais votado pelos participantes (1 voto já conta). Em empate, mantém-se
            a alternativa líder atual. Quando a banca publicar o gabarito oficial, o ranking será recalculado
            automaticamente.
          </>
        ) : (
          <>
            O gabarito oficial preliminar já foi cadastrado, mas ainda pode ser ajustado pela banca. As
            posições podem mudar até a versão definitiva.
          </>
        )}
      </AlertDescription>
    </Alert>
  );
}
