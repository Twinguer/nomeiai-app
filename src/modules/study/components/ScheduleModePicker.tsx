import React from 'react';
import { Button } from '@/components/ui/button';
import { Clock, Timer } from 'lucide-react';
import type { ScheduleMode } from '../domain/scheduleMode';

interface ScheduleModePickerProps {
  value: ScheduleMode;
  onChange: (mode: ScheduleMode) => void;
  lockedMode: ScheduleMode | null;
  disabled?: boolean;
}

export function ScheduleModePicker({ value, onChange, lockedMode, disabled }: ScheduleModePickerProps) {
  const effective = lockedMode ?? value;
  const isLocked = lockedMode !== null;

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">Tipo de agendamento</label>
      <div className="flex gap-2">
        <Button
          type="button"
          variant={effective === 'duration' ? 'default' : 'outline'}
          onClick={() => !isLocked && onChange('duration')}
          className="flex-1"
          size="sm"
          disabled={disabled || (isLocked && lockedMode !== 'duration')}
        >
          <Timer className="h-4 w-4 mr-2" />
          Tempo de Estudos
        </Button>
        <Button
          type="button"
          variant={effective === 'time' ? 'default' : 'outline'}
          onClick={() => !isLocked && onChange('time')}
          className="flex-1"
          size="sm"
          disabled={disabled || (isLocked && lockedMode !== 'time')}
        >
          <Clock className="h-4 w-4 mr-2" />
          Horário de Estudos
        </Button>
      </div>
      {isLocked ? (
        <p className="text-xs text-muted-foreground">
          Este ciclo usa{' '}
          {lockedMode === 'duration' ? 'tempo de estudos' : 'horário fixo'}. Para mudar o tipo, apague
          as tarefas e recrie o ciclo.
        </p>
      ) : effective === 'duration' ? (
        <p className="text-xs text-muted-foreground">
          Você poderá reorganizar as tarefas arrastando os cards entre dias e na ordem desejada.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          A ordem na semana segue o horário de início. Não é possível reorganizar os cards manualmente.
        </p>
      )}
    </div>
  );
}
