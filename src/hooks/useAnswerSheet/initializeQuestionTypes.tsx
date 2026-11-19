
import { Concurso } from '@/types/concursos';
import { devLog, sanitizeForLog } from '@/utils/productionLogger';

export const createQuestionOptions = (concurso: Concurso): Record<number, string[]> => {
  const questionOptions: Record<number, string[]> = {};
  
  if (!concurso) return questionOptions;
  
  const examType = concurso.exam_type || 'Alternativas';
  const alternativesCount = concurso.alternatives_count || 5;
  
  let questionNumber = 1;
  const totalQuestions = getTotalQuestions(concurso);
  
  // Se for prova de Certo ou Errado, todas questões tem as mesmas opções
  if (examType === 'Certo ou Errado') {
    for (let i = 1; i <= totalQuestions; i++) {
      questionOptions[i] = ['C', 'E'];
    }
    return questionOptions;
  }
  
  // Se for prova de alternativas, todas questões tem opções A, B, C, D, E (ou conforme alternativesCount)
  const options = Array.from({ length: alternativesCount }, (_, i) => String.fromCharCode(65 + i));
  
  for (let i = 1; i <= totalQuestions; i++) {
    questionOptions[i] = [...options];
  }
  
  return questionOptions;
};

export const getTotalQuestions = (concurso: Concurso): number => {
  if (!concurso) return 0;
  
  // Verificar se é a nova estrutura hierárquica (objeto com blocks)
  if (concurso.disciplines && typeof concurso.disciplines === 'object' && !Array.isArray(concurso.disciplines) && concurso.disciplines.blocks) {
    // Debug logs removed for security
    let total = 0;
    
    for (const block of concurso.disciplines.blocks) {
      if (block.disciplines && Array.isArray(block.disciplines)) {
        for (const discipline of block.disciplines) {
          if (discipline.isEnabled && discipline.questionCount) {
            const count = parseInt(String(discipline.questionCount), 10) || 0;
            // Debug logs removed for security
            total += count;
          }
        }
      }
    }
    
    // Debug logs removed for security
    return total;
  }
  
  // Verificar se é array (estrutura antiga)
  if (concurso.disciplines && Array.isArray(concurso.disciplines)) {
    devLog.log('[getTotalQuestions] Usando estrutura de disciplinas (array)');
    let total = 0;
    
    // Verificar se temos estrutura hierárquica (blocos -> disciplinas)
    const isHierarchical = concurso.disciplines.length > 0 && 
                          'disciplines' in concurso.disciplines[0];
    
    if (isHierarchical) {
      // Estrutura hierárquica
      for (const block of concurso.disciplines) {
        if ('disciplines' in block) {
          for (const discipline of block.disciplines) {
            if (discipline.isEnabled && discipline.questionCount) {
              total += parseInt(String(discipline.questionCount));
            }
          }
        }
      }
    } else {
      // Estrutura plana
      for (const discipline of concurso.disciplines) {
        if ('isEnabled' in discipline && discipline.isEnabled && discipline.questionCount) {
          total += parseInt(String(discipline.questionCount));
        }
      }
    }
    
    // Debug logs removed for security
    return total;
  }
  
  // Debug logs removed for security
  return 0;
};
