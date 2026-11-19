import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { PciConcursoFeedItem } from '@/types/pciConcursoFeed';
import { cn } from '@/lib/utils';
import { daysUntilInscricao, formatBRL } from '@/utils/pciConcursoFeedUtils';

interface PciConcursoCardProps {
  item: PciConcursoFeedItem;
  /** Clique no badge de UF — filtra concursos do mesmo estado */
  onUfClick?: (uf: string) => void;
  ufFilterActive?: string | null;
}

export function PciConcursoCard({ item, onUfClick, ufFilterActive }: PciConcursoCardProps) {
  const prazoFinal = item.inscricao_ate;
  const dias = daysUntilInscricao(prazoFinal);
  const urgente = dias != null && dias <= 7;
  const encerradas = dias != null && dias < 0;

  const prazoLabel =
    item.inscricao_texto && item.inscricao_texto.includes(' a ')
      ? `Inscrições: ${item.inscricao_texto}`
      : `Inscrições até ${item.inscricao_ate || '—'}`;

  const salarioDisplay =
    item.salario_texto ||
    (item.salario_min != null && item.salario_max != null
      ? `${formatBRL(item.salario_min)} a ${formatBRL(item.salario_max)}`
      : item.salario_max != null
        ? formatBRL(item.salario_max)
        : '—');

  return (
    <Card className="h-full transition-shadow hover:shadow-md hover:border-primary/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold leading-snug">{item.titulo}</CardTitle>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {item.uf ? (
            <Badge
              variant={ufFilterActive === item.uf.toUpperCase() ? 'default' : 'secondary'}
              className={cn(
                'text-xs',
                onUfClick && 'cursor-pointer hover:bg-primary/15',
              )}
              role={onUfClick ? 'button' : undefined}
              tabIndex={onUfClick ? 0 : undefined}
              onClick={
                onUfClick
                  ? (e) => {
                      e.stopPropagation();
                      onUfClick(item.uf!);
                    }
                  : undefined
              }
              onKeyDown={
                onUfClick
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onUfClick(item.uf!);
                      }
                    }
                  : undefined
              }
            >
              {item.uf}
            </Badge>
          ) : null}
          {item.vagas != null ? (
            <Badge variant="outline" className="border-primary/25 bg-primary/5 text-primary text-xs">
              {item.vagas.toLocaleString('pt-BR')} vagas
            </Badge>
          ) : null}
          {item.vagas_texto ? (
            <Badge variant="outline" className="text-xs">
              {item.vagas_texto}
            </Badge>
          ) : null}
          {item.status === 'prorrogado' ? (
            <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-xs">Prorrogado</Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground space-y-1.5">
        <p>
          <span className="font-medium text-foreground">Salário:</span> {salarioDisplay}
        </p>
        <p>
          <span className="font-medium text-foreground">Cargos:</span> {item.cargos || '—'}
        </p>
        <p>
          <span className="font-medium text-foreground">Escolaridade:</span> {item.escolaridade}
        </p>
        <p
          className={cn(
            'pt-1 font-semibold text-sm',
            urgente || encerradas ? 'text-destructive' : 'text-primary',
          )}
        >
          {prazoLabel}
          {dias != null
            ? encerradas
              ? ' (encerradas)'
              : ` (${dias} dia${dias === 1 ? '' : 's'})`
            : ''}
        </p>
      </CardContent>
    </Card>
  );
}
