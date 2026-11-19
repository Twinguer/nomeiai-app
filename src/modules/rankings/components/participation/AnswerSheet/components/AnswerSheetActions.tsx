import React from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Save, AlertTriangle } from 'lucide-react';
import { AnswerSheetActionsProps } from '../utils/answerSheetTypes';
import { ANSWER_SHEET_MESSAGES } from '../utils/answerSheetConstants';

export const AnswerSheetActions: React.FC<AnswerSheetActionsProps> = ({
  onSave,
  isSaving,
  canEdit,
  editCount = 0,
  disabled = false
}) => {
  const isDisabled = isSaving || (!canEdit && editCount > 0) || disabled;

  const getButtonContent = () => {
    if (isSaving) {
      return (
        <>
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          {ANSWER_SHEET_MESSAGES.SAVING}
        </>
      );
    }

    if (!canEdit && editCount > 0) {
      return (
        <>
          <AlertTriangle className="h-5 w-5 mr-2" />
          {ANSWER_SHEET_MESSAGES.EDIT_LIMIT_REACHED}
        </>
      );
    }

    return (
      <>
        <Save className="h-5 w-5 mr-2" />
        Salvar Cartão de Respostas
      </>
    );
  };

  return (
    <Button
      onClick={onSave}
      className="flex items-center w-full bg-emerald-600 hover:bg-emerald-700 text-white"
      disabled={isDisabled}
      size="lg"
    >
      {getButtonContent()}
    </Button>
  );
};



