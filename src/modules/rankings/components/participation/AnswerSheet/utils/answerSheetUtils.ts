import { Concurso } from '@/types/concursos';
import { ObjectiveSection } from './answerSheetTypes';
import { ANSWER_SHEET_CONSTANTS } from './answerSheetConstants';

// Utilitários do AnswerSheet

/**
 * Obtém o nome do caderno baseado no ID
 */
export const getBookletName = (bookletId: string | undefined, examBooklets: any[] = []): string => {
  if (!bookletId || !examBooklets) return 'Não informado';
  const booklet = examBooklets.find(b => b.id === bookletId);
  return booklet?.name || 'Não informado';
};

/**
 * Obtém todas as questões de todas as seções
 */
export const getAllQuestionsFromAllSections = (totalQuestions: number): number[] => {
  const allQuestions = [];
  for (let i = 1; i <= totalQuestions; i++) {
    allQuestions.push(i);
  }
  return allQuestions;
};

/**
 * Obtém seções objetivas baseadas na estrutura do concurso
 */
export const getObjectiveSections = (concurso: Concurso): ObjectiveSection[] => {
  if (!concurso) return [];
  
  const sections: ObjectiveSection[] = [];
  
  // Usar a estrutura de disciplinas do concurso
  if (concurso.disciplines && Array.isArray(concurso.disciplines) && concurso.disciplines.length > 0) {
    // Verificar se é estrutura hierárquica (blocos -> disciplinas)
    const isHierarchicalStructure = concurso.disciplines.length > 0 && 
                                  concurso.disciplines[0] && 
                                  typeof concurso.disciplines[0] === 'object' && 
                                  'name' in concurso.disciplines[0] && 
                                  'disciplines' in concurso.disciplines[0];
    
    if (isHierarchicalStructure) {
      // Estrutura hierárquica (blocos -> disciplinas)
      for (const block of concurso.disciplines) {
        if ('disciplines' in block) {
          for (const discipline of block.disciplines) {
            if (discipline.isEnabled && discipline.type) {
              sections.push({
                key: discipline.type,
                label: `${block.name} - ${discipline.name}`
              });
            }
          }
        }
      }
    } else {
      // Estrutura plana
      for (const discipline of concurso.disciplines) {
        if ('isEnabled' in discipline && discipline.isEnabled && discipline.type) {
          sections.push({
            key: discipline.type,
            label: discipline.name || discipline.type
          });
        }
      }
    }
  }
  
  return sections;
};

/**
 * Calcula o progresso de respostas
 */
export const calculateProgress = (answeredQuestions: number, totalQuestions: number): number => {
  if (totalQuestions === 0) return 0;
  return Math.round((answeredQuestions / totalQuestions) * 100);
};

/**
 * Valida se pode editar baseado no contador de edições e plano
 * @param editCount - Número de edições já feitas
 * @param isPro - Se o usuário tem plano Pro
 * @returns true se pode editar
 */
export const canEdit = (editCount: number = 0, isPro: boolean = false): boolean => {
  if (isPro) return true; // Pro = ilimitado
  return editCount < ANSWER_SHEET_CONSTANTS.MAX_EDIT_COUNT;
};

/**
 * Calcula edições restantes baseado no plano
 * @param editCount - Número de edições já feitas
 * @param isPro - Se o usuário tem plano Pro
 * @returns Número de edições restantes (Infinity para Pro)
 */
export const getEditsLeft = (editCount: number = 0, isPro: boolean = false): number => {
  if (isPro) return Infinity;
  return Math.max(0, ANSWER_SHEET_CONSTANTS.MAX_EDIT_COUNT - editCount);
};

/**
 * Valida pontuação subjetiva
 */
export const validateScore = (value: string, scoreName: string): { isValid: boolean; error?: string } => {
  if (value === '') {
    return { isValid: true };
  }

  const numberValue = parseFloat(value);
  if (isNaN(numberValue)) {
    return { isValid: false, error: `A nota da ${scoreName} deve ser um número válido.` };
  }

  if (numberValue < ANSWER_SHEET_CONSTANTS.MIN_SCORE || numberValue > ANSWER_SHEET_CONSTANTS.MAX_SCORE) {
    return { isValid: false, error: `A nota da ${scoreName} deve estar entre ${ANSWER_SHEET_CONSTANTS.MIN_SCORE} e ${ANSWER_SHEET_CONSTANTS.MAX_SCORE}.` };
  }

  return { isValid: true };
};

/**
 * Identifica questões não respondidas (excluindo anuladas)
 */
export const getUnansweredQuestions = (
  answers: Record<number, string>,
  nullifiedQuestions: Set<number>,
  totalQuestions: number
): number[] => {
  const unansweredQuestions: number[] = [];
  const allQuestions = getAllQuestionsFromAllSections(totalQuestions);

  for (const qNum of allQuestions) {
    if (!answers[qNum] && !nullifiedQuestions.has(qNum)) {
      unansweredQuestions.push(qNum);
    }
  }

  return unansweredQuestions.sort((a, b) => a - b);
};

/**
 * Verifica se deve mostrar seção subjetiva - APENAS JSONB
 */
export const shouldShowSubjective = (concurso: Concurso): boolean => {
  // Verificar nova estrutura hierárquica (objeto com blocks)
  if (concurso.disciplines && typeof concurso.disciplines === 'object' && !Array.isArray(concurso.disciplines) && concurso.disciplines.blocks) {
    for (const block of concurso.disciplines.blocks) {
      if (block.disciplines && Array.isArray(block.disciplines)) {
        for (const discipline of block.disciplines) {
          if (discipline.isEnabled && ['discursive', 'case_study_1', 'case_study_2', 'case_study_3', 'other_subjective'].includes(discipline.type)) {
            return true;
          }
        }
      }
    }
  }
  // Verificar estrutura antiga (array de blocos)
  else if (concurso.disciplines && Array.isArray(concurso.disciplines)) {
    for (const discipline of concurso.disciplines) {
      if ('disciplines' in discipline) {
        // Estrutura hierárquica (blocos)
        if (discipline.disciplines?.some(d => 
          d.isEnabled && ['discursive', 'case_study_1', 'case_study_2', 'case_study_3', 'other_subjective'].includes(d.type)
        )) {
          return true;
        }
      } else {
        // Estrutura plana
        if (discipline.isEnabled && ['discursive', 'case_study_1', 'case_study_2', 'case_study_3', 'other_subjective'].includes(discipline.type)) {
          return true;
        }
      }
    }
  }
  
  return false;
};

/**
 * Inicializa pontuações subjetivas padrão - APENAS JSONB
 */
export const initializeSubjectScores = (concurso: Concurso): Record<string, number> => {
  const initialScores: Record<string, number> = {};

  // Verificar JSONB disciplines apenas
  if (concurso.disciplines) {
    // Verificar nova estrutura hierárquica (objeto com blocks)
    if (typeof concurso.disciplines === 'object' && !Array.isArray(concurso.disciplines) && concurso.disciplines.blocks) {
      for (const block of concurso.disciplines.blocks) {
        if (block.disciplines && Array.isArray(block.disciplines)) {
          for (const discipline of block.disciplines) {
            if (discipline.isEnabled) {
              if (['discursive', 'case_study_1', 'case_study_2', 'case_study_3', 'other_subjective'].includes(discipline.type)) {
                initialScores[discipline.type] = 0;
              } else if (discipline.id) {
                // Disciplinas customizadas
                initialScores[`custom_${discipline.id}`] = 0;
              }
            }
          }
        }
      }
    }
    // Verificar estrutura antiga (array de blocos)
    else if (Array.isArray(concurso.disciplines)) {
      for (const discipline of concurso.disciplines) {
        if ('disciplines' in discipline) {
          // Estrutura hierárquica (blocos)
          if (discipline.disciplines && Array.isArray(discipline.disciplines)) {
            for (const d of discipline.disciplines) {
              if (d.isEnabled) {
                if (['discursive', 'case_study_1', 'case_study_2', 'case_study_3', 'other_subjective'].includes(d.type)) {
                  initialScores[d.type] = 0;
                } else if (d.id) {
                  // Disciplinas customizadas
                  initialScores[`custom_${d.id}`] = 0;
                }
              }
            }
          }
        } else {
          // Estrutura plana
          if (discipline.isEnabled) {
            if (['discursive', 'case_study_1', 'case_study_2', 'case_study_3', 'other_subjective'].includes(discipline.type)) {
              initialScores[discipline.type] = 0;
            } else if (discipline.id) {
              // Disciplinas customizadas
              initialScores[`custom_${discipline.id}`] = 0;
            }
          }
        }
      }
    }
  }
  
  return initialScores;
};

/**
 * Formata mensagem de questões anuladas
 */
export const formatNullifiedQuestionsMessage = (nullifiedQuestions: Set<number>): string => {
  const count = nullifiedQuestions.size;
  const questions = Array.from(nullifiedQuestions).sort((a, b) => a - b).join(', ');
  
  return count === 1 
    ? `Este concurso possui 1 questão anulada: ${questions}`
    : `Este concurso possui ${count} questões anuladas: ${questions}`;
};

/**
 * Gera ID único para componentes
 */
export const generateId = (prefix: string = 'answersheet'): string => {
  return `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Debounce para otimizar performance
 */
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let timeoutId: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
};

/**
 * Throttle para otimizar performance
 */
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let lastCall = 0;
  
  return (...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastCall >= delay) {
      lastCall = now;
      func(...args);
    }
  };
};
