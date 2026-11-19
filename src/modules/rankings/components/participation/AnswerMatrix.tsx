
import React from 'react';
import { QuestionCell } from './QuestionCell';
import { NullifyQuestionButton } from '@/components/Admin/NullifyQuestionButton';

interface AnswerMatrixProps {
  matrix: (number | null)[][];
  answers: { [key: number]: string };
  onAnswerChange: (questionNumber: number, answer: string) => void;
  getOptionsForQuestion: (questionNumber: number) => string[];
  disabled?: boolean;
  examType?: 'Alternativas' | 'Certo ou Errado';
  onClearAnswer?: (questionNumber: number) => void;
  nullifiedQuestions?: Set<number>;
  onNullifyQuestion?: (questionNumber: number) => void;
  isAdminView?: boolean;
}

export const AnswerMatrix: React.FC<AnswerMatrixProps> = ({
  matrix, 
  answers, 
  onAnswerChange,
  getOptionsForQuestion,
  disabled = false,
  examType = 'Alternativas',
  onClearAnswer,
  nullifiedQuestions = new Set(),
  onNullifyQuestion,
  isAdminView = false
}) => {
  // Debug logs removed for security
  // Debug logs removed for security
  // Debug logs removed for security
  
  if (!matrix || matrix.length === 0) {
    // Debug logs removed for security
    return (
      <div className="p-6 text-center text-muted-foreground">
        Nenhuma questão disponível para esta seção. Por favor, selecione outra seção.
      </div>
    );
  }

  // Check if there are any non-null question numbers in the matrix
  const hasQuestions = matrix.some(row => row.some(cell => cell !== null));
  // Debug logs removed for security
  // Debug logs removed for security
  
  if (!hasQuestions) {
    // Debug logs removed for security
    return (
      <div className="p-6 text-center text-muted-foreground">
        Nenhuma questão disponível para esta seção. Por favor, selecione outra seção.
      </div>
    );
  }

  return (
    <div className="p-4 bg-muted/30">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {matrix.map((row, rowIndex) => 
          row.map((questionNumber, colIndex) => 
            questionNumber !== null ? (
              <div key={`${rowIndex}-${colIndex}`} 
                className={`${
                  nullifiedQuestions.has(questionNumber) ? 'opacity-75' : ''
                }`}
              >
                <QuestionCell
                  questionNumber={questionNumber}
                  selectedAnswer={answers[questionNumber]}
                  onAnswerChange={onAnswerChange}
                  options={getOptionsForQuestion(questionNumber)}
                  disabled={disabled || nullifiedQuestions.has(questionNumber)}
                  examType={examType}
                  onClearAnswer={onClearAnswer}
                  isNullified={nullifiedQuestions.has(questionNumber)}
                />
                {isAdminView && onNullifyQuestion && (
                  <NullifyQuestionButton
                    questionNumber={questionNumber}
                    isNullified={nullifiedQuestions.has(questionNumber)}
                    onNullify={onNullifyQuestion}
                  />
                )}
              </div>
            ) : null
          )
        )}
      </div>
    </div>
  );
};
