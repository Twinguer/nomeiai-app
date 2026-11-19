
import { useState, useEffect } from 'react';
import { checkAnswerKeyCompleteness } from '@/services/answerKeyService';
import { devLog, sanitizeForLog } from '@/utils/productionLogger';

interface BookletCompleteness {
  bookletId: string;
  bookletName: string;
  completed: number;
  total: number;
  isComplete: boolean;
}

interface CompletenessResult {
  allComplete: boolean;
  details: BookletCompleteness[];
}

export const useAnswerKeyCompleteness = (
  concursoId: string | undefined,
  bookletIds: string[],
  expectedQuestions: number,
  refreshTrigger?: number
) => {
  const [completeness, setCompleteness] = useState<CompletenessResult>({
    allComplete: false,
    details: []
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!concursoId || bookletIds.length === 0) {
      return;
    }

    const checkCompleteness = async () => {
      setIsLoading(true);
      try {
        devLog.log('Verificando completude dos cadernos...');
        devLog.log('Total de questões esperadas:', expectedQuestions);
        
        const result = await checkAnswerKeyCompleteness(
          concursoId,
          bookletIds,
          expectedQuestions
        );
        
        // Log detalhado para cada caderno
        result.details.forEach(detail => {
          devLog.log(
            `Caderno ${detail.bookletName}: ${detail.completed}/${detail.total} questões ${
              detail.isComplete ? '(completo)' : '(incompleto)'
            }`
          );
        });
        
        devLog.log('Status de completude:', result);
        setCompleteness(result);
      } catch (error) {
        devLog.error('Erro ao verificar completude do gabarito:', error);
        setCompleteness({
          allComplete: false,
          details: bookletIds.map(id => ({
            bookletId: id,
            bookletName: `Caderno ${id}`,
            completed: 0,
            total: expectedQuestions,
            isComplete: false
          }))
        });
      } finally {
        setIsLoading(false);
      }
    };

    checkCompleteness();
  }, [concursoId, bookletIds, expectedQuestions, refreshTrigger]);

  return {
    completeness,
    isLoading,
    refresh: () => setCompleteness(prev => ({ ...prev }))
  };
};
