
import React from 'react';

interface AnswerOptionProps {
  option: string;
  isSelected: boolean;
  onClick: () => void;
  disabled?: boolean;
  examType?: 'Alternativas' | 'Certo ou Errado';
}

export const AnswerOption: React.FC<AnswerOptionProps> = ({ 
  option, 
  isSelected, 
  onClick,
  disabled = false,
  examType = 'Alternativas'
}) => {
  const isCertoErrado = examType === 'Certo ou Errado';
  
  return (
    <div 
      className={`
        ${isCertoErrado 
          ? 'w-10 h-10 text-sm font-medium'
          : 'w-8 h-8 text-sm font-medium'
        }
        flex items-center justify-center rounded-full cursor-pointer shadow-sm
        ${isSelected 
          ? 'bg-primary text-primary-foreground font-bold ring-2 ring-primary/30 ring-offset-2' 
          : disabled 
            ? 'bg-muted text-muted-foreground border border-border cursor-not-allowed'
            : 'bg-card hover:bg-primary/10 text-foreground border border-border hover:border-primary/30'
        }
        ${disabled ? 'opacity-70 cursor-not-allowed' : 'transition-all duration-150 ease-in-out'}
      `}
      onClick={disabled ? undefined : () => {
        // Log removido por segurança
        onClick();
      }}
      role="button"
      aria-pressed={isSelected}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      onKeyDown={(e) => {
        if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
          onClick();
        }
      }}
    >
      {option}
    </div>
  );
};
