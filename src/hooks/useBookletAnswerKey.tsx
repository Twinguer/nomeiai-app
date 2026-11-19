
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { devLog, sanitizeForLog } from '@/utils/productionLogger';

interface ExamBooklet {
  id: string;
  name: string;
  display_order: number;
}

export const useBookletAnswerKey = (concursoId: string) => {
  const [selectedBookletId, setSelectedBookletId] = useState<string>('');

  // Buscar cadernos disponíveis
  const { data: booklets, isLoading: isLoadingBooklets } = useQuery({
    queryKey: ['exam-booklets', concursoId],
    queryFn: async () => {
      // Log removido por segurança
      const { data: concursoData, error } = await supabase
        .from('concursos')
        .select('exam_booklets')
        .eq('id', concursoId)
        .single();
      const data = (concursoData?.exam_booklets as any[]) || [];
      // Ordenar por display_order
      const sortedData = (data as any[]).sort((a: any, b: any) => (a.display_order || 0) - (b.display_order || 0));

      if (error) {
        devLog.error('Erro ao buscar cadernos:', error);
        throw error;
      }
      
      // Log removido por segurança
      return sortedData || [];
    },
    enabled: !!concursoId,
    refetchOnWindowFocus: false,
    refetchOnMount: 'always',
    retry: 3,
    retryDelay: 1000,
    staleTime: 0
  });

  // Selecionar automaticamente o primeiro caderno disponível
  useEffect(() => {
    if (booklets && booklets.length > 0 && !selectedBookletId) {
      // Log removido por segurança
      setSelectedBookletId(booklets[0].id);
    }
  }, [booklets]); // Removido selectedBookletId da dependência para evitar loop

  // Verificar completude de todos os cadernos
  const { data: completionStatus } = useQuery({
    queryKey: ['booklets-completion', concursoId, booklets?.length],
    queryFn: async () => {
      if (!booklets || booklets.length === 0) {
        // Log removido por segurança
        return { allComplete: true, details: [] };
      }

      // Log removido por segurança
      const completionDetails = [];
      let allComplete = true;

      // Buscar o total de questões esperadas do concurso
      const { data: concurso } = await supabase
        .from('concursos')
        .select(`
          disciplines,
          official_answers,
          exam_booklets
        `)
        .eq('id', concursoId)
        .single();

      let expectedQuestions = 0;

      // Suporta a nova estrutura JSONB: objeto com blocks
      if (concurso?.disciplines && typeof concurso.disciplines === 'object' && !Array.isArray(concurso.disciplines)) {
        const blocks = (concurso.disciplines as any).blocks || [];
        blocks.forEach((block: any) => {
          if (block?.disciplines && Array.isArray(block.disciplines)) {
            block.disciplines.forEach((discipline: any) => {
              if (discipline?.isEnabled) {
                const raw = discipline.questionCount;
                const questionCount = typeof raw === 'string' ? parseInt(raw) || 0 : (raw || 0);
                expectedQuestions += questionCount;
              }
            });
          }
        });
      } else if (Array.isArray(concurso?.disciplines)) {
        // Compat: caso ainda venha como array hierárquico
        const arr = concurso.disciplines as any[];
        arr.forEach((block: any) => {
          if (block?.disciplines && Array.isArray(block.disciplines)) {
            block.disciplines.forEach((discipline: any) => {
              if (discipline?.isEnabled) {
                const raw = discipline.questionCount;
                const questionCount = typeof raw === 'string' ? parseInt(raw) || 0 : (raw || 0);
                expectedQuestions += questionCount;
              }
            });
          }
        });
      }

      // Fallback: se não encontrou via disciplines, tenta deduzir pelo primeiro caderno em official_answers
      if (!expectedQuestions || expectedQuestions === 0) {
        const firstKey = concurso?.official_answers ? Object.keys(concurso.official_answers)[0] : undefined;
        if (firstKey && concurso?.official_answers?.[firstKey]?.answers) {
          expectedQuestions = Object.keys(concurso.official_answers[firstKey].answers).length;
        }
      }

      // Log removido por segurança

      // Buscar dados do gabarito oficial uma vez só
      // Log removido por segurança
      const { data: concursoData } = await supabase
        .from('concursos')
        .select('official_answers')
        .eq('id', concursoId)
        .single();

      for (const booklet of booklets) {
        try {
          let answerCount = 0;
          
          if (concursoData?.official_answers?.[booklet.id]) {
            const bookletData = concursoData.official_answers[booklet.id];
            answerCount = Object.keys(bookletData.answers || {}).length;
          }

          const isComplete = expectedQuestions > 0 ? answerCount >= expectedQuestions : false;
          
          if (!isComplete) allComplete = false;

          completionDetails.push({
            bookletId: booklet.id,
            bookletName: booklet.name,
            completed: answerCount,
            total: expectedQuestions,
            isComplete
          });

          // Log removido por segurança
        } catch (error) {
          devLog.error(`Erro ao verificar completude do caderno ${booklet.id}:`, error);
          allComplete = false;
          completionDetails.push({
            bookletId: booklet.id,
            bookletName: booklet.name,
            completed: 0,
            total: expectedQuestions,
            isComplete: false
          });
        }
      }

      // Log removido por segurança
      return { allComplete, details: completionDetails };
    },
    enabled: !!booklets && booklets.length > 0 && !!concursoId,
    refetchOnWindowFocus: false,
    staleTime: 30000
  });

  const handleBookletChange = (bookletId: string) => {
    // Log removido por segurança
    setSelectedBookletId(bookletId);
  };

  return {
    booklets: booklets || [],
    selectedBookletId,
    setSelectedBookletId: handleBookletChange,
    isLoading: isLoadingBooklets,
    completionStatus
  };
};
