import React from 'react';
import { Concurso } from '@/types/concursos';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
export type QuotaType = 'Ampla Concorrência' | 'PPP' | 'PCD' | 'Hipossuficientes' | 'Indígenas' | 'Pessoas Trans';
interface QuotaSelectorProps {
  concurso: Concurso;
  selectedQuota: QuotaType;
  onQuotaChange: (quota: QuotaType) => void;
}
export const QuotaSelector: React.FC<QuotaSelectorProps> = ({
  concurso,
  selectedQuota,
  onQuotaChange
}) => {
  // Usar dados do concurso diretamente (JSONB has_cota)
  const config = concurso.has_cota || {
    ppp: false,
    pcd: false,
    ind: false,
    hip: false,
    tra: false,
    min_cota: 0
  };


  // Build available quotas based on JSONB config
  const availableQuotas = [{
    value: 'Ampla Concorrência',
    label: 'Ampla Concorrência',
    enabled: true // Ampla sempre disponível
  },
  {
    value: 'PPP',
    label: 'Pessoas Pretas e Pardas (PPP)',
    enabled: config.ppp === true
  }, {
    value: 'PCD',
    label: 'Pessoas com Deficiência (PCD)',
    enabled: config.pcd === true
  }, {
    value: 'Hipossuficientes',
    label: 'Hipossuficientes',
    enabled: config.hip === true
  }, {
    value: 'Indígenas',
    label: 'Indígenas',
    enabled: config.ind === true
  }, {
    value: 'Pessoas Trans',
    label: 'Pessoas Trans',
    enabled: config.tra === true
  }].filter(quota => quota.enabled);

  // Log removido para reduzir overhead em produção

  // If there are no quotas available, default to Ampla Concorrência only
  if (availableQuotas.length <= 1) {
    return null;
  }
  return <div className="mb-6">
      <h3 className="text-md font-medium mb-2">Selecione a reserva de vagas</h3>
      
      
      <RadioGroup value={selectedQuota} onValueChange={value => {
      // Debug logs removed for security
      onQuotaChange(value as QuotaType);
    }} className="flex flex-col space-y-2">
        {availableQuotas.map(quota => <div key={quota.value} className="flex items-center space-x-2 border border-border p-3 rounded-md hover:bg-muted/50 bg-card">
            <RadioGroupItem value={quota.value} id={`quota-${quota.value}`} />
            <Label htmlFor={`quota-${quota.value}`} className="cursor-pointer">{quota.label}</Label>
          </div>)}
      </RadioGroup>
      
      
    </div>;
};