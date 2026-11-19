import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScheduleModePicker } from './ScheduleModePicker';
import type { StudyCycleV2 } from '@/types/userStudy';
import type { CronogramaStudySession } from '../hooks/useCronogramaData';
import type { ScheduleMode } from '../domain/scheduleMode';

interface BlockOption {
  name: string;
  id: string;
}

interface DisciplineOption {
  name: string;
  id: string;
}

interface ScheduleTaskPlanEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: CronogramaStudySession | null;
  cycles: StudyCycleV2[];
  weekDays: string[];
  sessionTimeMode: ScheduleMode;
  onSessionTimeModeChange: (mode: ScheduleMode) => void;
  lockedMode: ScheduleMode | null;
  selectedBlock: string;
  onSelectedBlockChange: (value: string) => void;
  selectedDiscipline: string;
  onSelectedDisciplineChange: (value: string) => void;
  customBlock: string;
  onCustomBlockChange: (value: string) => void;
  customDiscipline: string;
  onCustomDisciplineChange: (value: string) => void;
  selectedDay: number;
  onSelectedDayChange: (day: number) => void;
  startTime: string;
  onStartTimeChange: (value: string) => void;
  endTime: string;
  onEndTimeChange: (value: string) => void;
  durationMinutes: number;
  onDurationMinutesChange: (value: number) => void;
  sessionLink: string;
  onSessionLinkChange: (value: string) => void;
  availableBlocks: BlockOption[];
  availableDisciplines: DisciplineOption[];
  onSave: () => void;
  saving?: boolean;
}

export function ScheduleTaskPlanEditDialog({
  open,
  onOpenChange,
  session,
  cycles,
  weekDays,
  sessionTimeMode,
  onSessionTimeModeChange,
  lockedMode,
  selectedBlock,
  onSelectedBlockChange,
  selectedDiscipline,
  onSelectedDisciplineChange,
  customBlock,
  onCustomBlockChange,
  customDiscipline,
  onCustomDisciplineChange,
  selectedDay,
  onSelectedDayChange,
  startTime,
  onStartTimeChange,
  endTime,
  onEndTimeChange,
  durationMinutes,
  onDurationMinutesChange,
  sessionLink,
  onSessionLinkChange,
  availableBlocks,
  availableDisciplines,
  onSave,
  saving = false,
}: ScheduleTaskPlanEditDialogProps) {
  const cycleName = cycles.find((c) => c.id === session?.cycleId)?.cycle_name ?? 'Ciclo';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar Tarefa</DialogTitle>
          <DialogDescription>
            Altere disciplina, dia, horário ou link da tarefa planejada
          </DialogDescription>
        </DialogHeader>

        {session && (
          <div className="space-y-4">
            <div className="p-3 bg-muted rounded-md text-sm">
              <span className="text-muted-foreground">Ciclo: </span>
              <span className="font-medium">{cycleName}</span>
            </div>

            <ScheduleModePicker
              value={sessionTimeMode}
              onChange={onSessionTimeModeChange}
              lockedMode={lockedMode}
            />

            <div>
              <label className="text-sm font-medium">Bloco</label>
              <Select value={selectedBlock} onValueChange={onSelectedBlockChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um bloco" />
                </SelectTrigger>
                <SelectContent>
                  {availableBlocks.map((block) => (
                    <SelectItem key={block.name} value={block.name}>
                      {block.name}
                    </SelectItem>
                  ))}
                  <SelectItem value="__custom__">+ Adicionar novo bloco</SelectItem>
                </SelectContent>
              </Select>
              {selectedBlock === '__custom__' && (
                <Input
                  placeholder="Digite o nome do bloco"
                  value={customBlock}
                  onChange={(e) => onCustomBlockChange(e.target.value)}
                  className="mt-2"
                />
              )}
            </div>

            <div>
              <label className="text-sm font-medium">Disciplina</label>
              <Select value={selectedDiscipline} onValueChange={onSelectedDisciplineChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma disciplina" />
                </SelectTrigger>
                <SelectContent>
                  {availableDisciplines.map((discipline) => (
                    <SelectItem key={discipline.name} value={discipline.name}>
                      {discipline.name}
                    </SelectItem>
                  ))}
                  <SelectItem value="__custom__">+ Adicionar nova disciplina</SelectItem>
                </SelectContent>
              </Select>
              {selectedDiscipline === '__custom__' && (
                <Input
                  placeholder="Digite o nome da disciplina"
                  value={customDiscipline}
                  onChange={(e) => onCustomDisciplineChange(e.target.value)}
                  className="mt-2"
                />
              )}
            </div>

            <div>
              <label className="text-sm font-medium">Dia da Semana</label>
              <Select
                value={selectedDay.toString()}
                onValueChange={(value) => onSelectedDayChange(Number(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um dia" />
                </SelectTrigger>
                <SelectContent>
                  {weekDays.map((day, index) => (
                    <SelectItem key={index} value={index.toString()}>
                      {day}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {sessionTimeMode === 'time' ? (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Horário de Início</label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => onStartTimeChange(e.target.value)}
                    className="w-full p-2 border rounded-md"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Horário de Fim</label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => onEndTimeChange(e.target.value)}
                    className="w-full p-2 border rounded-md"
                  />
                </div>
              </div>
            ) : (
              <div>
                <label className="text-sm font-medium">Duração (minutos)</label>
                <Input
                  type="number"
                  min="5"
                  max="480"
                  step="5"
                  value={durationMinutes}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    if (value >= 5 && value <= 480) {
                      onDurationMinutesChange(value);
                    }
                  }}
                  placeholder="90"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Duração entre 5 e 480 minutos (8 horas).
                </p>
              </div>
            )}

            <div>
              <label className="text-sm font-medium">Link da Tarefa (opcional)</label>
              <Input
                type="url"
                value={sessionLink}
                onChange={(e) => onSessionLinkChange(e.target.value)}
                placeholder="https://..."
              />
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
                Cancelar
              </Button>
              <Button onClick={onSave} className="flex-1" disabled={saving}>
                {saving ? 'Salvando...' : 'Salvar alterações'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
