
import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Button } from '@/components/ui/button';
import { Scale } from 'lucide-react';

interface WeightedAnswerInputProps {
  questionNumber: number;
  selectedAnswer?: string;
  weight?: number;
  options: string[];
  isNullified?: boolean;
  disabled?: boolean;
  onAnswerChange: (questionNumber: number, answer: string) => void;
  onWeightChange: (questionNumber: number, weight: number) => void;
  onNullifyQuestion: (questionNumber: number) => void;
}

export const WeightedAnswerInput: React.FC<WeightedAnswerInputProps> = ({
  questionNumber,
  selectedAnswer = '',
  weight = 1,
  options,
  isNullified = false,
  disabled = false,
  onAnswerChange,
  onWeightChange,
  onNullifyQuestion
}) => {
  return (
    <div className="border border-border p-4 rounded-lg bg-card shadow-sm">
      <div className="flex justify-between items-start mb-2">
        <div>
          <Label className="text-sm font-medium">Questão {questionNumber}</Label>
          {weight !== 1 && (
            <span className="ml-2 text-xs text-primary flex items-center">
              <Scale className="h-3 w-3 mr-1" />
              Peso {weight}
            </span>
          )}
        </div>
        <Button
          type="button"
          variant={isNullified ? "destructive" : "outline"}
          size="sm"
          onClick={() => onNullifyQuestion(questionNumber)}
          className="text-xs"
        >
          {isNullified ? "Anulada" : "Anular"}
        </Button>
      </div>

      <RadioGroup
        value={selectedAnswer}
        onValueChange={(value) => onAnswerChange(questionNumber, value)}
        className="flex flex-wrap gap-2 mb-3"
        disabled={disabled || isNullified}
      >
        {options.map((option) => (
          <div key={option} className="flex items-center space-x-1">
            <RadioGroupItem
              value={option}
              id={`q${questionNumber}-${option}`}
            />
            <Label htmlFor={`q${questionNumber}-${option}`} className="text-sm">
              {option}
            </Label>
          </div>
        ))}
      </RadioGroup>

      <div className="mt-2">
        <Label className="text-xs text-muted-foreground mb-1">Peso da questão</Label>
        <Input
          type="number"
          min="0.1"
          step="0.1"
          value={weight}
          onChange={(e) => onWeightChange(questionNumber, parseFloat(e.target.value) || 1)}
          className="w-24 text-sm"
          disabled={disabled || isNullified}
        />
      </div>
    </div>
  );
};
