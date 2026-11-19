
import { getConsolidatedAnswerKey, getBookletAnswers } from './core';
import { saveBookletAnswerKey, updateSingleAnswer } from './save';
import { checkAnswerKeyCompleteness, getAnswerKeyStats } from './stats';
import { supabase } from '@/integrations/supabase/client';
import { devLog, sanitizeForLog } from '@/utils/productionLogger';

// Serviço principal
const answerKeyService = {
  getConsolidatedAnswerKey,
  getBookletAnswers,
  saveBookletAnswerKey,
  updateSingleAnswer,
  checkAnswerKeyCompleteness,
  getAnswerKeyStats
};

// Funções auxiliares exportadas individualmente (para compatibilidade)
export const getAnswerKeyForBooklet = async (concursoId: string, bookletId: string) => {
  try {
    // Debug logs removed for security
    
    const consolidatedData = await getConsolidatedAnswerKey(concursoId);
    
    if (!consolidatedData?.booklets?.[bookletId]) {
      // Debug logs removed for security
      return { success: true, data: [] };
    }

    const bookletData = consolidatedData.booklets[bookletId];
    const questionsData = (bookletData.answers || (bookletData as any)?.questions || {});
    const answers = Object.entries(questionsData).map(([questionNum, answerData]: [string, any]) => ({
      question_number: parseInt(questionNum),
      correct_answer: answerData.correct_answer,
      weight: answerData.weight || 1.0,
      section_type: answerData.section_type,
      is_nullified: answerData.is_nullified || false,
      answer_format: answerData.answer_format || 'OBJECTIVE',
      question_type: answerData.question_type || 'MULTIPLE_CHOICE'
    }));

    // Debug logs removed for security
    return { success: true, data: answers };
  } catch (error: any) {
    devLog.error('[getAnswerKeyForBooklet] Error:', error);
    return { success: false, error: error.message };
  }
};

export const getAllBookletsAnswerKeys = async (concursoId: string) => {
  try {
    const consolidatedData = await getConsolidatedAnswerKey(concursoId);
    
    if (!consolidatedData) {
      return { success: true, data: null };
    }

    devLog.log('[getAllBookletsAnswerKeys] Found consolidated data with', 
      Object.keys(consolidatedData.booklets || {}).length, 'booklets');
    return { success: true, data: consolidatedData };
  } catch (error: any) {
    devLog.error('[getAllBookletsAnswerKeys] Error:', error);
    return { success: false, error: error.message };
  }
};

// Função para salvar gabarito usando nova estrutura consolidada
export const saveBookletAnswerKeyLegacy = async (
  concursoId: string,
  bookletId: string,
  answersArray: any[],
  gabaritoStatus: 'preliminary' | 'final' = 'preliminary'
) => {
  try {
    // Debug logs removed for security
    // Debug logs removed for security

    // Converter array para o formato Record<string, AnswerKeyData> esperado
    // Não definir answerFormat e questionType aqui - deixar para saveBookletAnswerKey resolver
    const formattedAnswers: Record<string, any> = {};
    answersArray.forEach((answer) => {
      const questionKey = answer.question_number.toString();
      formattedAnswers[questionKey] = {
        correctAnswer: answer.correct_answer,
        weight: answer.weight || 1.0,
        sectionType: answer.section_type || 'basic',
        isNullified: answer.is_nullified || false
      };
    });

    // Usar o novo serviço consolidado diretamente
    const result = await saveBookletAnswerKey(concursoId, bookletId, formattedAnswers, gabaritoStatus);
    
    if (!result.success) {
      devLog.error('[saveBookletAnswerKeyLegacy] Error using consolidated service:', result.error);
      return { success: false, error: result.error };
    }

    // Debug logs removed for security
    return { success: true, data: result.data };

  } catch (error: any) {
    devLog.error('[saveBookletAnswerKeyLegacy] Exception:', error);
    return { success: false, error: error.message };
  }
};

// Export the main service as default and named export
export default answerKeyService;
export { answerKeyService };

// Export individual functions for direct use
export { saveBookletAnswerKey, updateSingleAnswer, getConsolidatedAnswerKey, getBookletAnswers, checkAnswerKeyCompleteness, getAnswerKeyStats };
export * from './types';
