
import { Concurso } from '@/types/concursos';
import { supabase } from '@/integrations/supabase/client';
import { devLog, sanitizeForLog } from '@/utils/productionLogger';

// Calculate the total number of objective questions in the exam
export const getTotalQuestions = (concurso: Concurso): number => {
  if (!concurso) return 0;
  
  devLog.log('[getTotalQuestions] Calculando total de questões para concurso:', concurso.id);
  
  // Always use disciplines structure (new system)
  if (concurso.disciplines && Array.isArray(concurso.disciplines)) {
    devLog.log('[getTotalQuestions] Usando estrutura de disciplinas');
    let totalQuestions = 0;
    
    // Check if hierarchical structure (blocks -> disciplines)
    const isHierarchical = concurso.disciplines.length > 0 && 
                          concurso.disciplines[0] && 
                          typeof concurso.disciplines[0] === 'object' && 
                          'name' in concurso.disciplines[0] && 
                          'disciplines' in concurso.disciplines[0];
    
    if (isHierarchical) {
      // Process hierarchical structure
      for (const block of concurso.disciplines) {
        if ('disciplines' in block && Array.isArray(block.disciplines)) {
          for (const discipline of block.disciplines) {
            if (discipline.isEnabled && discipline.questionCount) {
              const questionCount = typeof discipline.questionCount === 'number'
                ? discipline.questionCount
                : Number(String(discipline.questionCount || '0'));
                
              // Debug logs removed for security
              totalQuestions += questionCount;
            }
          }
        }
      }
    } else {
      // Process flat structure - verificar se é array
      if (Array.isArray(concurso.disciplines)) {
        for (const discipline of concurso.disciplines) {
          if (discipline.isEnabled && discipline.questionCount) {
            const questionCount = typeof discipline.questionCount === 'number'
              ? discipline.questionCount
              : Number(String(discipline.questionCount || '0'));
              
            // Debug logs removed for security
            totalQuestions += questionCount;
          }
        }
      }
    }
    
    devLog.log(`[getTotalQuestions] Total de questões: ${totalQuestions}`);
    return totalQuestions;
  }
  
  // Debug logs removed for security
  return 0;
};

// Get the count of questions that have been answered
export const getAnsweredQuestionsCount = (answers: { [key: number]: string }): number => {
  const count = Object.keys(answers).length;
  devLog.log(`[getAnsweredQuestionsCount] Total de respostas: ${count}`);
  return count;
};

// Check if official answers are missing for a given concurso and booklet
export const checkMissingOfficialAnswers = async (concursoId: string, bookletId: string): Promise<boolean> => {
  try {
    // Debug logs removed for security
    
    const { data, error } = await supabase
      .from('concursos')
      .select('official_answers')
      .eq('id', concursoId)
      .maybeSingle();

    // Debug logs removed for security

    if (error || !data) {
      devLog.log('[checkMissingOfficialAnswers] Erro ao buscar gabarito oficial ou gabarito não encontrado');
      return true;
    }

    // Debug logs removed for security
    // Debug logs removed for security

    // A estrutura real tem os cadernos diretamente no primeiro nível
    const bookletData = data?.official_answers?.[bookletId];
    // Debug logs removed for security
    // Debug logs removed for security
    // Debug logs removed for security
    
    // Verificar se o gabarito existe e tem questões
    const questions = bookletData?.questions || bookletData?.answers || {};
    if (!bookletData || !questions || Object.keys(questions).length === 0) {
      // Debug logs removed for security
      return true;
    }

    // Verificar se há pelo menos uma questão
    const questionCount = Object.keys(questions).length;
    if (questionCount === 0) {
      // Debug logs removed for security
      return true;
    }

    // Debug logs removed for security
    return false;
  } catch (error) {
    devLog.error('[checkMissingOfficialAnswers] Erro ao verificar gabarito oficial:', error);
    return true;
  }
};
