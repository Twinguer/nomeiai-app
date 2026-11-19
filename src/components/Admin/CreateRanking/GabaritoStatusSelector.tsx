import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import type { Concurso } from '@/types/concursos';

export type GabaritoBancaStatus = 'preliminary' | 'final';

interface GabaritoStatusSelectorProps {
  value: GabaritoBancaStatus;
  onChange: (value: GabaritoBancaStatus) => void;
  disabled?: boolean;
}

export function GabaritoStatusSelector({ value, onChange, disabled }: GabaritoStatusSelectorProps) {
  return (
    <div className="rounded-md border border-border bg-muted/30 p-4 space-y-3">
      <div>
        <Label className="text-sm font-medium">Status do gabarito da banca</Label>
        <p className="text-xs text-muted-foreground mt-1">
          Informe se este gabarito é provisório (pode ser alterado) ou definitivo (versão final da banca).
        </p>
      </div>
      <RadioGroup
        value={value}
        onValueChange={(v) => onChange(v as GabaritoBancaStatus)}
        className="flex flex-col sm:flex-row gap-4"
        disabled={disabled}
      >
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="preliminary" id="gabarito-preliminary" />
          <Label htmlFor="gabarito-preliminary" className="font-normal cursor-pointer">
            Provisório (preliminar)
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="final" id="gabarito-final" />
          <Label htmlFor="gabarito-final" className="font-normal cursor-pointer">
            Definitivo
          </Label>
        </div>
      </RadioGroup>
    </div>
  );
}

export function isConsensusMode(concurso?: Pick<Concurso, 'gabarito_status'> | null): boolean {
  const status = concurso?.gabarito_status ?? 'consensus';
  return status === 'consensus';
}
