
import React from 'react';
import { AnswerOption } from './AnswerOption';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface QuestionCellProps {
  questionNumber: number;
  selectedAnswer?: string;
  onAnswerChange: (questionNumber: number, answer: string) => void;
  options: string[];
  disabled?: boolean;
  examType?: 'Alternativas' | 'Certo ou Errado';
  onClearAnswer?: (questionNumber: number) => void;
  isNullified?: boolean;
}

export const QuestionCell: React.FC<QuestionCellProps> = ({
  questionNumber,
  selectedAnswer,
  onAnswerChange,
  options,
  disabled = false,
  examType = 'Alternativas',
  onClearAnswer,
  isNullified = false
}) => {
  const isCertoErrado = examType === 'Certo ou Errado';
  
  const handleOptionClick = (option: string) => {
    // Se clicar na opção já selecionada em prova C/E, deseleciona (deixa em branco)
    if (isCertoErrado && selectedAnswer === option) {
      if (onClearAnswer) {
        onClearAnswer(questionNumber);
      }
    } else {
      onAnswerChange(questionNumber, option);
    }
  };
  
  // Log removido por segurança - não expor respostas do usuário
  return (
    <div className={`border border-border rounded-md p-3 ${isNullified ? 'bg-muted/50' : 'bg-card'}`}>
      <div className="flex justify-between items-center mb-2">
        <div className="font-medium text-foreground">
          Questão {questionNumber}
          {isNullified && (
            <span className="ml-2 text-xs text-amber-600 dark:text-amber-400 font-normal bg-amber-50 dark:bg-amber-950/30 px-1.5 py-0.5 rounded-full">
              Anulada
            </span>
          )}
        </div>
        
        {selectedAnswer && onClearAnswer && !isNullified && (
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-6 w-6 p-0" 
            onClick={() => onClearAnswer(questionNumber)}
            disabled={disabled}
            title="Limpar resposta"
          >
            <X className="h-3 w-3" />
            <span className="sr-only">Limpar resposta</span>
          </Button>
        )}
      </div>
      
      <div className="flex flex-nowrap gap-1 justify-center">
        {options.map((option) => (
          <AnswerOption
            key={option}
            option={option}
            isSelected={selectedAnswer === option}
            onClick={() => handleOptionClick(option)}
            disabled={disabled || isNullified}
            examType={examType}
          />
        ))}
      </div>
      
      {isNullified && (
        <div className="mt-2 text-xs text-amber-700 dark:text-amber-400 italic">
          Esta questão foi anulada. Você receberá a pontuação automaticamente.
        </div>
      )}
    </div>
  );
};
