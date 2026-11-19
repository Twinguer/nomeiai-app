
import React from 'react';
import { Button } from '@/components/ui/button';
import { Ban } from 'lucide-react';

interface NullifyQuestionButtonProps {
  questionNumber: number;
  isNullified: boolean;
  onNullify: (questionNumber: number) => void;
  disabled?: boolean;
}

export const NullifyQuestionButton = ({
  questionNumber,
  isNullified,
  onNullify,
  disabled = false
}: NullifyQuestionButtonProps) => {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => onNullify(questionNumber)}
      disabled={disabled}
      className={`mt-2 w-full gap-2 ${
        isNullified 
          ? 'bg-muted text-muted-foreground' 
          : 'hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600 dark:hover:text-red-400'
      }`}
    >
      <Ban className="h-4 w-4" />
      {isNullified ? 'Questão Anulada' : 'Anular Questão'}
    </Button>
  );
};
