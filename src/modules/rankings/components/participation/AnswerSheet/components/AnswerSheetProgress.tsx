import React from 'react';
import { Progress } from '@/components/ui/progress';
import { AnswerSheetProgress as AnswerSheetProgressType } from '../utils/answerSheetTypes';
import { formatNullifiedQuestionsMessage } from '../utils/answerSheetUtils';
import { HelpCircle } from 'lucide-react';

interface AnswerSheetProgressProps {
  progress: AnswerSheetProgressType;
  showNullifiedWarning?: boolean;
}

export const AnswerSheetProgress: React.FC<AnswerSheetProgressProps> = ({
  progress,
  showNullifiedWarning = true
}) => {
  const {
    totalQuestions,
    answeredQuestions,
    progressPercentage,
    hasNullifiedQuestions,
    nullifiedQuestions
  } = progress;

  return (
    <div className="space-y-4">
      {/* Aviso de questões anuladas */}
      {showNullifiedWarning && hasNullifiedQuestions && (
        <div className="bg-amber-50 border border-amber-200 rounded-md p-4">
          <div className="flex items-start gap-3">
            <HelpCircle className="h-5 w-5 text-amber-500 mt-0.5" />
            <div>
              <h4 className="font-medium text-amber-800">Questões Anuladas</h4>
              <p className="text-sm text-amber-700 mt-1">
                {formatNullifiedQuestionsMessage(nullifiedQuestions)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Barra de progresso */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="font-medium">
            Progresso: {answeredQuestions} de {totalQuestions} questões
          </div>
          <div className="text-sm text-muted-foreground">
            {Math.round(progressPercentage)}% completo
          </div>
        </div>
        <Progress 
          value={progressPercentage} 
          className="h-2" 
        />
      </div>
    </div>
  );
};



