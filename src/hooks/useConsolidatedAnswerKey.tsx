
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAllBookletsAnswerKeys, saveBookletAnswerKeyLegacy } from '@/services/answerKeyService';
import { toast } from 'sonner';
import { devLog, sanitizeForLog } from '@/utils/productionLogger';

export const useConsolidatedAnswerKey = (concursoId: string) => {
  const queryClient = useQueryClient();

  // Get consolidated answer key for all booklets
  const { data: consolidatedAnswerKey, isLoading } = useQuery({
    queryKey: ['consolidated-answer-key', concursoId],
    queryFn: async () => {
      const result = await getAllBookletsAnswerKeys(concursoId);
      
      if (!result.success) {
        throw new Error(result.error);
      }
      
      return result.data;
    },
    staleTime: 30000,
  });

  // Save answer key for specific booklet
  const saveBookletAnswerKeyMutation = useMutation({
    mutationFn: async ({ 
      bookletId, 
      answers 
    }: { 
      bookletId: string; 
      answers: any[];
    }) => {
      const result = await saveBookletAnswerKeyLegacy(concursoId, bookletId, answers);
      
      if (!result.success) {
        throw new Error(result.error);
      }
      
      return result;
    },
    onSuccess: () => {
      toast.success('Gabarito do caderno salvo com sucesso');
      queryClient.invalidateQueries({ queryKey: ['consolidated-answer-key', concursoId] });
      queryClient.invalidateQueries({ queryKey: ['official-answers-weights', concursoId] });
    },
    onError: (error) => {
      devLog.error('Error saving booklet answer key:', error);
      toast.error('Erro ao salvar gabarito do caderno');
    }
  });

  // Get answer key for specific booklet
  const getBookletAnswerKey = (bookletId: string) => {
    if (!consolidatedAnswerKey?.booklets?.[bookletId]) {
      return [];
    }

    const bookletData = consolidatedAnswerKey.booklets[bookletId];
    const questionsData = (bookletData.answers || (bookletData as any)?.questions || {});
    return Object.entries(questionsData).map(([questionNum, answerData]: [string, any]) => ({
      question_number: parseInt(questionNum),
      correct_answer: answerData.correct_answer,
      weight: answerData.weight || 1.0,
      section_type: answerData.section_type,
      is_nullified: answerData.is_nullified || false,
      answer_format: answerData.answer_format || 'OBJECTIVE',
      question_type: answerData.question_type || 'MULTIPLE_CHOICE'
    }));
  };

  // Get completion status for all booklets
  const getCompletionStatus = () => {
    if (!consolidatedAnswerKey?.booklets) {
      return { completed: [], incomplete: [], allComplete: false };
    }

    const bookletIds = Object.keys(consolidatedAnswerKey.booklets);
    const completed = bookletIds.filter(id => {
      const booklet = consolidatedAnswerKey.booklets[id];
      return booklet?.answers && Object.keys(booklet.answers).length > 0;
    });
    
    const incomplete = bookletIds.filter(id => !completed.includes(id));
    
    return {
      completed,
      incomplete,
      allComplete: incomplete.length === 0 && completed.length > 0
    };
  };

  return {
    consolidatedAnswerKey,
    isLoading,
    saveBookletAnswerKey: saveBookletAnswerKeyMutation.mutate,
    isSaving: saveBookletAnswerKeyMutation.isPending,
    getBookletAnswerKey,
    getCompletionStatus
  };
};
