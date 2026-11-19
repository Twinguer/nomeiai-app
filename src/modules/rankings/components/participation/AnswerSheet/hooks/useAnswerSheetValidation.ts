import { useMemo } from 'react';
import { Concurso } from '@/types/concursos';
import { AnswerSheetValidation } from '../utils/answerSheetTypes';
import { canEdit, getEditsLeft, getUnansweredQuestions, shouldShowSubjective } from '../utils/answerSheetUtils';
import { ANSWER_SHEET_CONSTANTS } from '../utils/answerSheetConstants';
import { useSubscription } from '@/modules/payments';

/**
 * Hook para gerenciar validações do AnswerSheet
 */
export const useAnswerSheetValidation = (
  concurso: Concurso,
  userRankingData: any,
  answers: Record<number, string>,
  nullifiedQuestions: Set<number>,
  totalQuestions: number,
  answeredQuestions: number,
  subjectScores: Record<string, number> = {}
) => {
  const { isPro } = useSubscription();
  
  // Validações calculadas
  const validation = useMemo((): AnswerSheetValidation => {
    const editCount = userRankingData?.edit_count || 0;
    const editsLeft = getEditsLeft(editCount, isPro);
    const canEditValue = canEdit(editCount, isPro);
    const progressPercentage = totalQuestions ? (answeredQuestions / totalQuestions) * 100 : 0;
    const hasNullifiedQuestions = nullifiedQuestions.size > 0;

    return {
      canEdit: canEditValue,
      editsLeft,
      totalQuestions,
      answeredQuestions,
      progressPercentage: Math.round(progressPercentage),
      hasNullifiedQuestions
    };
  }, [userRankingData?.edit_count, totalQuestions, answeredQuestions, nullifiedQuestions.size, isPro]);

  // Validação de questões não respondidas
  const validateUnansweredQuestions = useMemo(() => {
    const isCertoErrado = concurso.exam_type === 'Certo ou Errado';
    
    if (isCertoErrado) {
      return { isValid: true, unansweredQuestions: [] };
    }

    const unansweredQuestions = getUnansweredQuestions(answers, nullifiedQuestions, totalQuestions);
    const isValid = unansweredQuestions.length === 0;

    return {
      isValid,
      unansweredQuestions,
      errorMessage: isValid ? null : `Existem questões que precisam ser respondidas: ${unansweredQuestions.join(', ')}`
    };
  }, [concurso.exam_type, answers, nullifiedQuestions, totalQuestions]);

  // Validação de pontuação subjetiva
  const validateSubjectiveScores = useMemo(() => {
    const shouldShow = shouldShowSubjective(concurso);
    
    if (!shouldShow) {
      return { isValid: true, errors: [] };
    }

    const errors: string[] = [];
    
    // Verificar se há seções subjetivas habilitadas - APENAS JSONB
    let hasSubjectiveSections = false;
    
    // Verificar nova estrutura hierárquica (objeto com blocks)
    if (concurso.disciplines && typeof concurso.disciplines === 'object' && !Array.isArray(concurso.disciplines) && concurso.disciplines.blocks) {
      for (const block of concurso.disciplines.blocks) {
        if (block.disciplines && Array.isArray(block.disciplines)) {
          for (const discipline of block.disciplines) {
            if (discipline.isEnabled && ['discursive', 'case_study_1', 'case_study_2', 'case_study_3', 'other_subjective'].includes(discipline.type)) {
              hasSubjectiveSections = true;
              break;
            }
          }
        }
        if (hasSubjectiveSections) break;
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
            hasSubjectiveSections = true;
            break;
          }
        } else {
          // Estrutura plana
          if (discipline.isEnabled && ['discursive', 'case_study_1', 'case_study_2', 'case_study_3', 'other_subjective'].includes(discipline.type)) {
            hasSubjectiveSections = true;
            break;
          }
        }
      }
    }

    if (!hasSubjectiveSections) {
      return { isValid: true, errors: [] };
    }
    
    // Validar todas as pontuações subjetivas baseadas no JSONB disciplines
    const subjectiveTypes = ['discursive', 'case_study_1', 'case_study_2', 'case_study_3', 'other_subjective'];
    
    subjectiveTypes.forEach(type => {
      if (subjectScores[type] !== undefined) {
        const score = subjectScores[type] || 0;
        if (score < 0 || score > 10) {
          const typeLabels: Record<string, string> = {
            'discursive': 'Prova Discursiva',
            'case_study_1': 'Estudo de Caso 1',
            'case_study_2': 'Estudo de Caso 2',
            'case_study_3': 'Estudo de Caso 3',
            'other_subjective': 'Outro Subjetivo'
          };
          errors.push(`A pontuação de ${typeLabels[type]} deve estar entre 0 e 10`);
        }
      }
    });

    // Validar disciplinas customizadas da nova estrutura JSONB
    if (concurso.disciplines) {
      // Verificar nova estrutura hierárquica (objeto com blocks)
      if (typeof concurso.disciplines === 'object' && !Array.isArray(concurso.disciplines) && concurso.disciplines.blocks) {
        for (const block of concurso.disciplines.blocks) {
          if (block.disciplines && Array.isArray(block.disciplines)) {
            for (const discipline of block.disciplines) {
              if (discipline.isEnabled && discipline.type && subjectScores[discipline.type] !== undefined) {
                const score = subjectScores[discipline.type] || 0;
                if (score < 0 || score > 10) {
                  errors.push(`A pontuação de ${discipline.name} deve estar entre 0 e 10`);
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
                if (d.isEnabled && d.type && subjectScores[d.type] !== undefined) {
                  const score = subjectScores[d.type] || 0;
                  if (score < 0 || score > 10) {
                    errors.push(`A pontuação de ${d.name} deve estar entre 0 e 10`);
                  }
                }
              }
            }
          } else {
            // Estrutura plana
            if (discipline.isEnabled && discipline.type && subjectScores[discipline.type] !== undefined) {
              const score = subjectScores[discipline.type] || 0;
              if (score < 0 || score > 10) {
                errors.push(`A pontuação de ${discipline.name} deve estar entre 0 e 10`);
              }
            }
          }
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }, [concurso, subjectScores]);

  // Validação geral para salvamento
  const validateForSave = useMemo(() => {
    const hasConcursoId = !!concurso?.id;
    const hasSelectedBooklet = !!userRankingData?.selected_booklet;
    const hasValidAnswers = validateUnansweredQuestions.isValid;
    const hasValidSubjectiveScores = validateSubjectiveScores.isValid;
    const canEditValue = validation.canEdit;

    const isValid = hasConcursoId && 
                   hasSelectedBooklet && 
                   hasValidAnswers && 
                   hasValidSubjectiveScores && 
                   canEditValue;

    const errors: string[] = [];
    
    if (!hasConcursoId) {
      errors.push('ID do concurso não encontrado');
    }
    
    if (!hasSelectedBooklet) {
      errors.push('É necessário selecionar um caderno de prova antes de salvar as respostas');
    }
    
    if (!hasValidAnswers && validateUnansweredQuestions.errorMessage) {
      errors.push(validateUnansweredQuestions.errorMessage);
    }
    
    if (!hasValidSubjectiveScores) {
      errors.push(...validateSubjectiveScores.errors);
    }
    
    if (!canEditValue) {
      errors.push('Você atingiu o limite de edições permitidas');
    }

    return {
      isValid,
      errors,
      errorMessage: errors.length > 0 ? errors.join('; ') : null
    };
  }, [
    concurso?.id,
    userRankingData?.selected_booklet,
    validateUnansweredQuestions.isValid,
    validateUnansweredQuestions.errorMessage,
    validateSubjectiveScores.isValid,
    validateSubjectiveScores.errors,
    validation.canEdit
  ]);

  // Validação de pontuação individual
  const validateScore = (value: string, scoreName: string) => {
    if (value === '') {
      return { isValid: true };
    }

    const numberValue = parseFloat(value);
    if (isNaN(numberValue)) {
      return { 
        isValid: false, 
        error: `A nota da ${scoreName} deve ser um número válido.` 
      };
    }

    if (numberValue < ANSWER_SHEET_CONSTANTS.MIN_SCORE || numberValue > ANSWER_SHEET_CONSTANTS.MAX_SCORE) {
      return { 
        isValid: false, 
        error: `A nota da ${scoreName} deve estar entre ${ANSWER_SHEET_CONSTANTS.MIN_SCORE} e ${ANSWER_SHEET_CONSTANTS.MAX_SCORE}.` 
      };
    }

    return { isValid: true };
  };

  return {
    // Validações principais
    validation,
    validateUnansweredQuestions,
    validateSubjectiveScores,
    validateForSave,
    
    // Funções de validação
    validateScore,
    
    // Estados calculados
    canEdit: validation.canEdit,
    editsLeft: validation.editsLeft,
    totalQuestions: validation.totalQuestions,
    answeredQuestions: validation.answeredQuestions,
    progressPercentage: validation.progressPercentage,
    hasNullifiedQuestions: validation.hasNullifiedQuestions
  };
};


