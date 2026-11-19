import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AnswerKeyForm } from '../AnswerKeyForm';
import { BookletAnswerKeySelector } from './BookletAnswerKeySelector';
import { useBookletAnswerKey } from '@/hooks/useBookletAnswerKey';
import { FileText, AlertCircle, Info } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface AnswerKeyTabProps {
  concursoId: string;
  onGoToResults?: () => void;
}

export const AnswerKeyTab: React.FC<AnswerKeyTabProps> = ({
  concursoId,
  onGoToResults,
}) => {
  const {
    booklets,
    selectedBookletId,
    setSelectedBookletId,
    isLoading,
    completionStatus,
  } = useBookletAnswerKey(concursoId);
  const [showAnswerForm, setShowAnswerForm] = useState(false);

  useEffect(() => {
    if (selectedBookletId && booklets.length > 0) {
      setShowAnswerForm(true);
    } else {
      setShowAnswerForm(false);
    }
  }, [selectedBookletId, booklets]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2" />
          <p>Carregando informações dos cadernos...</p>
        </div>
      </div>
    );
  }

  if (!booklets || booklets.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Gabarito da Banca
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800 dark:text-amber-200">
              Configure os cadernos de prova na aba &quot;Informações Gerais&quot; para poder cadastrar o
              gabarito quando a banca publicar.
            </AlertDescription>
          </Alert>
          {onGoToResults && (
            <Button type="button" variant="outline" onClick={onGoToResults}>
              Ir para Resultados (modo consenso)
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Alert className="border-primary/20 bg-primary/5">
        <Info className="h-4 w-4 text-primary" />
        <AlertTitle>Gabarito opcional</AlertTitle>
        <AlertDescription>
          Sem gabarito cadastrado, o ranking funciona por <strong>consenso</strong> entre os participantes.
          Quando a banca publicar o gabarito, preencha aqui e indique se é provisório ou definitivo.
        </AlertDescription>
      </Alert>

      <BookletAnswerKeySelector
        booklets={booklets}
        selectedBookletId={selectedBookletId}
        onBookletChange={setSelectedBookletId}
        completionStatus={completionStatus}
        disabled={false}
      />

      {selectedBookletId ? (
        showAnswerForm ? (
          <AnswerKeyForm concursoId={concursoId} bookletId={selectedBookletId} />
        ) : (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center text-muted-foreground">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Carregando gabarito do caderno selecionado...</p>
              </div>
            </CardContent>
          </Card>
        )
      ) : (
        <Card>
          <CardContent className="pt-6">
            <Alert className="border-primary/20 bg-primary/10">
              <AlertCircle className="h-4 w-4 text-primary" />
              <AlertDescription className="text-foreground">
                Selecione um caderno acima para cadastrar o gabarito da banca, ou vá direto aos resultados
                em modo consenso.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}

      {onGoToResults && (
        <div className="flex justify-end">
          <Button type="button" variant="outline" onClick={onGoToResults}>
            Ir para Resultados
            {!completionStatus?.allComplete && ' (modo consenso)'}
          </Button>
        </div>
      )}
    </div>
  );
};
