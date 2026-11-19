
import { supabase } from '../client';
import { devLog, sanitizeForLog } from '@/utils/productionLogger';

/**
 * Interface for subjective scores
 */
interface SubjectiveScores {
  discursive?: number | null;
  case_study_1?: number | null;
  case_study_2?: number | null;
  case_study_3?: number | null;
  other_subjective?: number | null;
}

/**
 * Interface for concurso answer data in consolidated structure
 */
interface ConcursoAnswerData {
  answers?: {
    [bookletId: string]: { [questionNumber: string]: string };
  };
  subjective_scores?: SubjectiveScores;
}

// Interface para a nova estrutura JSON consolidada
interface ConsolidatedAnswers {
  booklets: {
    [bookletId: string]: {
      answers: { [questionNumber: string]: string };
      metadata: {
        completed_at: string;
        answer_count: number;
      };
    };
  };
  subjective_scores: {
    discursive: number;
    case_study_1: number;
    case_study_2: number;
    case_study_3: number;
  };
  selected_booklet: string;
  total_edit_count: number;
  metadata: {
    last_updated: string;
    version: string;
  };
}

// Função para buscar as respostas consolidadas (NOVA ESTRUTURA)
export const fetchUserAnswers = async (rankingId: string, concursoId?: string) => {
  try {
    // Buscar dados consolidados da nova estrutura unificada
    // Note: rankingId is actually the user_id in the new structure
    const { data, error } = await supabase
      .from('user_rankings')
      .select('consolidated_data, selected_booklet, edit_count')
      .eq('user_id', rankingId)
      .maybeSingle();
      
    if (error) {
      devLog.error('[fetchUserAnswers] Error:', error);
      return {};
    }

    if (!data?.consolidated_data || data.consolidated_data === '{}') {
      return {};
    }

    const consolidatedData = data.consolidated_data;
    const selectedBooklet = data.selected_booklet;
    const editCount = data.edit_count || 0;

    // Se especificou concurso, buscar apenas dados desse concurso
    let answers: { [key: number]: string } = {};
    let subjectiveScoresForConcurso: SubjectiveScores = {};

    if (concursoId) {
      const concursoKey = concursoId;
      const concursoData = consolidatedData[concursoKey] as ConcursoAnswerData | undefined;
      
      if (concursoData?.answers) {
        // Buscar respostas do caderno selecionado ou primeiro disponível
        const bookletId = selectedBooklet || Object.keys(concursoData.answers)[0];
        if (bookletId && concursoData.answers[bookletId]) {
          Object.entries(concursoData.answers[bookletId]).forEach(([questionNum, answer]) => {
            answers[parseInt(questionNum)] = answer as string;
          });
        }
      }
      
      // Buscar notas subjetivas da estrutura consolidada
      subjectiveScoresForConcurso = concursoData?.subjective_scores || {};
    } else {
      // Buscar respostas de todos os concursos (compatibilidade)
      Object.values(consolidatedData).forEach((concursoData: any) => {
        if (concursoData?.answers) {
          Object.values(concursoData.answers).forEach((booklet: any) => {
            if (booklet) {
              Object.entries(booklet).forEach(([questionNum, answer]) => {
                answers[parseInt(questionNum)] = answer as string;
              });
            }
          });
        }
      });
      
      // Para múltiplos concursos, retornar o primeiro encontrado
      const firstConcurso = Object.values(consolidatedData)[0] as any;
      subjectiveScoresForConcurso = firstConcurso?.subjective_scores || {};
    }

    return {
      answers,
      discursiveScore: subjectiveScoresForConcurso.discursive || null,
      caseStudy1Score: subjectiveScoresForConcurso.case_study_1 || null,
      caseStudy2Score: subjectiveScoresForConcurso.case_study_2 || null,
      caseStudy3Score: subjectiveScoresForConcurso.case_study_3 || null,
      otherSubjectiveScore: subjectiveScoresForConcurso.other_subjective || null,
      selectedBooklet: selectedBooklet,
      editCount: editCount,
      consolidatedData, // Retornar dados completos para uso avançado
      subjectiveScores: subjectiveScoresForConcurso
    };
  } catch (error) {
    devLog.error('[fetchUserAnswers] Erro ao buscar respostas consolidadas:', error);
    return {};
  }
};

// Função para buscar respostas de um caderno específico (NOVA ESTRUTURA)
export const fetchUserAnswersForBooklet = async (rankingId: string, bookletId: string, concursoId?: string) => {
  try {
    const result = await fetchUserAnswers(rankingId, concursoId);
    
    if (result.consolidatedData) {
      // Buscar em todos os concursos se não especificado
      if (concursoId) {
        const concursoData = result.consolidatedData[concursoId] as ConcursoAnswerData | undefined;
        if (concursoData?.answers?.[bookletId]) {
          return concursoData.answers[bookletId];
        }
      } else {
        // Buscar em todos os concursos
        for (const concursoData of Object.values(result.consolidatedData)) {
          const typedConcursoData = concursoData as ConcursoAnswerData;
          if (typedConcursoData?.answers?.[bookletId]) {
            return typedConcursoData.answers[bookletId];
          }
        }
      }
    }
    
    return {};
  } catch (error) {
    devLog.error('[fetchUserAnswersForBooklet] Erro:', error);
    return {};
  }
};

// Função legada mantida para compatibilidade - agora redireciona para consolidatedAnswerService
export const saveUserAnswers = async (
  rankingId: string, 
  concursoId: string,
  answers: { questionNumber: number; answer: string; isBasicKnowledge?: boolean }[]
) => {
  devLog.log('[saveUserAnswers] Função legada redirecionando para RPC consolidada...');
  // Esta função agora apenas redireciona - a real implementação está no useSaveAnswers.tsx
  return true;
};

// Re-exporta a função de recálculo em lote para manter compatibilidade
export { recalculateAllUserScores } from './batchOperations';
