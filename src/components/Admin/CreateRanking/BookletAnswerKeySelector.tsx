import React from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { FileText, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
interface ExamBooklet {
  id: string;
  name: string;
  display_order: number;
}
interface CompletionDetail {
  bookletId: string;
  bookletName: string;
  completed: number;
  total: number;
  isComplete: boolean;
}
interface CompletionStatus {
  allComplete: boolean;
  details: CompletionDetail[];
}
interface BookletAnswerKeySelectorProps {
  booklets: ExamBooklet[];
  selectedBookletId: string;
  onBookletChange: (bookletId: string) => void;
  completionStatus?: CompletionStatus;
  disabled?: boolean;
}
export const BookletAnswerKeySelector: React.FC<BookletAnswerKeySelectorProps> = ({
  booklets,
  selectedBookletId,
  onBookletChange,
  completionStatus,
  disabled = false
}) => {
  // Log removido por segurança
  if (!booklets || booklets.length === 0) {
    return <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground">
            <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Nenhum caderno de prova configurado</p>
            <p className="text-xs">Configure cadernos na seção "Informações Gerais"</p>
          </div>
        </CardContent>
      </Card>;
  }
  return <Card className="mb-6">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            <h3 className="text-lg font-semibold">Escolher Caderno do Gabarito</h3>
          </div>
          {completionStatus && <Badge variant={completionStatus.allComplete ? "default" : "secondary"}>
              {completionStatus.allComplete ? <>
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Todos Completos
                </> : <>
                  <Clock className="h-3 w-3 mr-1" />
                  {completionStatus.details.filter(d => d.isComplete).length}/{completionStatus.details.length} Completos
                </>}
            </Badge>}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="booklet-selector" className="text-sm font-medium">
            Caderno para preencher gabarito
          </Label>
          <Select value={selectedBookletId} onValueChange={onBookletChange} disabled={disabled}>
            <SelectTrigger id="booklet-selector">
              <SelectValue placeholder="Selecione o caderno para preencher o gabarito" />
            </SelectTrigger>
            <SelectContent>
              {booklets.map(booklet => {
              const completion = completionStatus?.details.find(d => d.bookletId === booklet.id);
              // Log removido por segurança
              return <SelectItem key={booklet.id} value={booklet.id}>
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        <span className="font-medium">{booklet.name}</span>
                        {completion?.isComplete && <CheckCircle className="h-3 w-3 text-success" />}
                      </div>
                      {completion && <Badge variant={completion.isComplete ? "default" : "secondary"} className="ml-2">
                          {completion.completed}/{completion.total}
                        </Badge>}
                    </div>
                  </SelectItem>;
            })}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            O gabarito é opcional. Enquanto não houver gabarito da banca, o ranking usa consenso entre
            participantes. Preencha cada caderno quando a banca publicar o gabarito correspondente.
          </p>
        </div>

        {/* Status de completude por caderno */}
        {completionStatus && completionStatus.details.length > 0 && <div className="space-y-2">
            <Label className="text-sm font-medium">Status dos Gabaritos por Caderno</Label>
            <div className="grid gap-2">
              {completionStatus.details.map(detail => <div key={detail.bookletId} className={`flex items-center justify-between p-3 rounded border transition-colors ${detail.bookletId === selectedBookletId ? 'bg-primary/5 border-primary/20' : ''} ${detail.isComplete ? 'bg-success/5 border-success/20' : 'bg-warning/5 border-warning/20'}`}>
                <div className="flex items-center gap-2">
                  {detail.isComplete ? <CheckCircle className="h-4 w-4 text-success" /> : <AlertCircle className="h-4 w-4 text-warning" />}
                  <span className="text-sm font-medium">
                    {detail.bookletName}
                    {detail.bookletId === selectedBookletId && <span className="text-primary ml-1">(Selecionado)</span>}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={detail.isComplete ? "default" : "secondary"}>
                    {detail.completed}/{detail.total} questões
                  </Badge>
                  {detail.isComplete && <CheckCircle className="h-4 w-4 text-success" />}
                </div>
              </div>)}
            </div>
          </div>}

        {/* Aviso sobre obrigatoriedade */}
        {completionStatus && !completionStatus.allComplete}

        {/* Mensagem de sucesso quando todos estão completos */}
        {completionStatus && completionStatus.allComplete && (
          <div className="p-4 rounded bg-success/5 border border-success/20">
            <div className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-success mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-success">Gabaritos completos</p>
                <p className="text-success/80 mt-1">
                  Todos os {completionStatus.details.length} cadernos possuem gabarito cadastrado.
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>;
};