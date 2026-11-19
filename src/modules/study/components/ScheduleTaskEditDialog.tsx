import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Timer } from 'lucide-react';

export interface CronogramaTaskSession {
  id: string;
  day: number;
  startTime?: string;
  endTime?: string;
  durationMinutes?: number;
  disciplineName: string;
  blockName: string;
  cycleId: string;
  sessionLink?: string;
}

interface ScheduleTaskEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: CronogramaTaskSession | null;
  sessionLink: string;
  onSessionLinkChange: (value: string) => void;
  courseName: string;
  onCourseNameChange: (value: string) => void;
  studyDuration: number;
  onStudyDurationChange: (value: number) => void;
  studyType: 'pdf' | 'video';
  onStudyTypeChange: (value: 'pdf' | 'video') => void;
  questionsTotal: number;
  onQuestionsTotalChange: (value: number) => void;
  questionsCorrect: number;
  onQuestionsCorrectChange: (value: number) => void;
  questionsError: string;
  onValidateQuestions: (total: number, correct: number) => boolean;
  currentVideo: string;
  onCurrentVideoChange: (value: string) => void;
  studyNotes: string;
  onStudyNotesChange: (value: string) => void;
  onSave: () => void;
  onStartTimer: () => void;
}

export function ScheduleTaskEditDialog({
  open,
  onOpenChange,
  session,
  sessionLink,
  onSessionLinkChange,
  courseName,
  onCourseNameChange,
  studyDuration,
  onStudyDurationChange,
  studyType,
  onStudyTypeChange,
  questionsTotal,
  onQuestionsTotalChange,
  questionsCorrect,
  onQuestionsCorrectChange,
  questionsError,
  onValidateQuestions,
  currentVideo,
  onCurrentVideoChange,
  studyNotes,
  onStudyNotesChange,
  onSave,
  onStartTimer,
}: ScheduleTaskEditDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar Tarefa de Estudo</DialogTitle>
          <DialogDescription>Registre os detalhes da sua tarefa de estudo realizada</DialogDescription>
        </DialogHeader>
        {session && (
          <div className="space-y-4">
            <div className="p-3 bg-muted rounded-md">
              <div className="text-sm font-medium">{session.disciplineName}</div>
              <div className="text-xs text-muted-foreground">{session.blockName}</div>
              <div className="text-xs text-muted-foreground">
                {session.durationMinutes ? (
                  <span className="flex items-center gap-1">
                    <Timer className="h-3 w-3" />
                    {session.durationMinutes}min
                  </span>
                ) : session.startTime && session.endTime ? (
                  `${session.startTime} - ${session.endTime}`
                ) : (
                  'Horário livre'
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="sessionLink">Link da Tarefa (Aula/Vídeo/Sistema)</Label>
              <Input
                id="sessionLink"
                type="url"
                value={sessionLink}
                onChange={(e) => onSessionLinkChange(e.target.value)}
                placeholder="https://exemplo.com/aula ou sistema de questões"
              />
            </div>

            <div>
              <Label htmlFor="courseName">Assunto</Label>
              <Input
                id="courseName"
                value={courseName}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value.length <= 50) onCourseNameChange(value);
                }}
                placeholder="Ex: Curso Completo de Direito Constitucional"
                maxLength={50}
              />
              <p className="text-xs text-muted-foreground mt-1">{courseName.length}/50 caracteres</p>
            </div>

            <div className="rounded-md border border-primary/30 bg-primary/5 p-3 space-y-2">
              <p className="text-sm text-muted-foreground">
                Tempo e questões entram nas estatísticas ao <strong className="text-foreground">salvar</strong>{' '}
                este formulário. O timer ajuda a focar e pode sugerir minutos aqui quando você voltar do estudo.
              </p>
              <Button type="button" variant="outline" className="w-full" onClick={onStartTimer}>
                <Timer className="h-4 w-4 mr-2" />
                Abrir timer de foco
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="duration">Tempo na tarefa (minutos)</Label>
                <Input
                  id="duration"
                  type="number"
                  min="0"
                  max={999}
                  value={studyDuration}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === '' || (Number(value) >= 0 && Number(value) <= 999 && value.length <= 3)) {
                      onStudyDurationChange(value === '' ? 0 : Number(value));
                    }
                  }}
                  placeholder="Ex: 60"
                  maxLength={3}
                />
              </div>

              <div>
                <Label htmlFor="studyType">Tipo de Estudo</Label>
                <Select value={studyType} onValueChange={(value: 'pdf' | 'video') => onStudyTypeChange(value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pdf">PDF</SelectItem>
                    <SelectItem value="video">Vídeo Aula</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="questions-total">Total de questões</Label>
                <Input
                  id="questions-total"
                  type="number"
                  min="0"
                  max={9999}
                  value={questionsTotal}
                  onChange={(e) => {
                    const inputValue = e.target.value;
                    if (
                      inputValue === '' ||
                      (Number(inputValue) >= 0 && Number(inputValue) <= 9999 && inputValue.length <= 4)
                    ) {
                      const value = inputValue === '' ? 0 : Number(inputValue);
                      onQuestionsTotalChange(value);
                      if (questionsCorrect > value) onQuestionsCorrectChange(value);
                    }
                  }}
                  placeholder="Questões resolvidas"
                  maxLength={4}
                />
              </div>

              {questionsTotal > 0 && (
                <div>
                  <Label htmlFor="questions-correct">Questões corretas</Label>
                  <Input
                    id="questions-correct"
                    type="number"
                    min="0"
                    max={questionsTotal}
                    value={questionsCorrect}
                    onChange={(e) => {
                      const value = Number(e.target.value);
                      onQuestionsCorrectChange(value);
                      onValidateQuestions(questionsTotal, value);
                    }}
                    placeholder="Acertos"
                    className={questionsError ? 'border-red-500' : ''}
                  />
                  {questionsError && <p className="text-sm text-red-500 mt-1">{questionsError}</p>}
                </div>
              )}
            </div>

            {questionsTotal > 0 && (
              <div className="p-3 bg-muted rounded-md">
                <div className="text-sm text-muted-foreground">
                  Aproveitamento: {((questionsCorrect / questionsTotal) * 100).toFixed(1)}%
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {questionsCorrect} acertos • {questionsTotal - questionsCorrect} erros • {questionsTotal} total
                </div>
              </div>
            )}

            {studyType === 'video' && (
              <div>
                <Label htmlFor="currentVideo">Aula/Vídeo atual</Label>
                <Input
                  id="currentVideo"
                  value={currentVideo}
                  onChange={(e) => onCurrentVideoChange(e.target.value)}
                  placeholder="Ex: Aula 05 - Princípios Constitucionais"
                />
              </div>
            )}

            <div>
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                value={studyNotes}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value.length <= 300) onStudyNotesChange(value);
                }}
                placeholder="O que você estudou, dificuldades, pontos importantes..."
                rows={3}
                maxLength={300}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground mt-1">{studyNotes.length}/300 caracteres</p>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
                Cancelar
              </Button>
              <Button onClick={onSave} className="flex-1">
                Salvar Tarefa
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
