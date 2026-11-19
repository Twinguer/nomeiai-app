
import { supabase } from '@/integrations/supabase/client';
import { AnswerKeyData } from './types';
import { devLog, sanitizeForLog } from '@/utils/productionLogger';

export const saveBookletAnswerKey = async (
  concursoId: string, 
  bookletId: string, 
  answers: Record<string, AnswerKeyData>,
  gabaritoStatus: 'preliminary' | 'final' = 'preliminary'
) => {
  try {
    // Debug logs removed for security
    // Debug logs removed for security
    // Debug logs removed for security
    // Debug logs removed for security

    // Buscar exam_type do concurso para definir question_type corretamente
    const { data: concursoData, error: concursoError } = await supabase
      .from('concursos')
      .select('exam_type')
      .eq('id', concursoId)
      .single();

    if (concursoError || !concursoData) {
      devLog.error('[answerKeyService] Error fetching concurso exam_type:', concursoError);
      return { success: false, error: 'Erro ao buscar tipo de exame do concurso' };
    }

    const questionType = concursoData.exam_type === 'Certo ou Errado' ? 'TRUE_FALSE' : 'MULTIPLE_CHOICE';
    // Debug logs removed for security

    // Garantir que bookletId seja sempre string
    const bookletIdString = String(bookletId);
    // Debug logs removed for security

    // Converter o formato de answers para o formato esperado pela função RPC
    const formattedAnswers: Record<string, any> = {};
    
    Object.entries(answers).forEach(([questionNumber, answerData]) => {
      // Debug logs removed for security
      
      formattedAnswers[questionNumber] = {
        correct_answer: answerData.correctAnswer,
        weight: answerData.weight,
        section_type: answerData.sectionType,
        is_nullified: answerData.isNullified,
        answer_format: 'OBJECTIVE',
        question_type: questionType // Usar o tipo detectado
      };
    });

    // Debug logs removed for security
    // Debug logs removed for security

    // Usar a função RPC que agora deve funcionar sem trigger problems
    const { data, error } = await supabase.rpc('save_consolidated_answer_key', {
      p_concurso_id: concursoId,
      p_booklet_id: bookletIdString,
      p_answers: formattedAnswers,
      p_gabarito_status: gabaritoStatus,
    });

    if (error) {
      devLog.error('[answerKeyService] RPC Error details:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      return { success: false, error: error.message };
    }

    // Debug logs removed for security
    
    // Verificar se a resposta indica sucesso
    if (data && typeof data === 'object' && 'success' in data && !data.success) {
      devLog.error('[answerKeyService] RPC returned failure:', data);
      return { success: false, error: data.error || 'Falha na função do banco de dados' };
    }

    return { success: true, data };
  } catch (error: any) {
    devLog.error('[answerKeyService] Exception in saveBookletAnswerKey:', error);
    return { success: false, error: error.message };
  }
};

export const updateSingleAnswer = async (
  concursoId: string, 
  questionNumber: number, 
  answerData: AnswerKeyData,
  gabaritoStatus: 'preliminary' | 'final' = 'preliminary'
) => {
  try {
    devLog.log('[answerKeyService] Updating single answer');
    devLog.log('[answerKeyService] Question:', questionNumber, 'Answer:', answerData);

    // Buscar exam_type do concurso para definir question_type corretamente
    const { data: concursoData, error: concursoError } = await supabase
      .from('concursos')
      .select('exam_type')
      .eq('id', concursoId)
      .single();

    if (concursoError || !concursoData) {
      devLog.error('[answerKeyService] Error fetching concurso exam_type:', concursoError);
      return { success: false, error: 'Erro ao buscar tipo de exame do concurso' };
    }

    const questionType = concursoData.exam_type === 'Certo ou Errado' ? 'TRUE_FALSE' : 'MULTIPLE_CHOICE';

    // Como não temos mais a função update_answer_with_weight que usava booklet_id,
    // vamos usar a função consolidada para atualizar uma única resposta
    const singleAnswerData = {
      [questionNumber.toString()]: {
        correct_answer: answerData.correctAnswer,
        weight: answerData.weight,
        section_type: answerData.sectionType,
        is_nullified: answerData.isNullified,
        answer_format: 'OBJECTIVE',
        question_type: questionType // Usar o tipo detectado
      }
    };

    const { data, error } = await supabase.rpc('save_consolidated_answer_key', {
      p_concurso_id: concursoId,
      p_booklet_id: 'default',
      p_answers: singleAnswerData,
      p_gabarito_status: gabaritoStatus,
    });

    if (error) {
      devLog.error('[answerKeyService] Error updating single answer:', error);
      return { success: false, error: error.message };
    }

    // Verificar se a resposta indica sucesso
    if (data && typeof data === 'object' && 'success' in data && !data.success) {
      devLog.error('[answerKeyService] RPC returned failure for single answer:', data);
      return { success: false, error: data.error || 'Falha na atualização da resposta' };
    }

    devLog.log('[answerKeyService] Successfully updated answer:', data);
    return { success: true, data };
  } catch (error: any) {
    devLog.error('[answerKeyService] Error in updateSingleAnswer:', error);
    return { success: false, error: error.message };
  }
};
