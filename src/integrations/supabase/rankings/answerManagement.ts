
import { supabase } from '../client';
import { getSectionTypeForQuestion, sanitizeSectionType } from './examStructure';
import { devLog, sanitizeForLog } from '@/utils/productionLogger';
import { RPCValidator } from '@/utils/rpcValidator';

// FUNÇÃO ATUALIZADA PARA TRABALHAR COM DADOS CONSOLIDADOS
export const saveUserAnswersData = async (
  rankingId: string,
  concursoId: string,
  answers: { questionNumber: number; answer: string }[]
) => {
  try {
    devLog.log('[answerManagement] Redirecionando para estrutura consolidada...');
    
    // Carregar dados do concurso para determinar as faixas das seções
    const { data: concurso, error: concursoError } = await supabase
      .from('concursos')
      .select('*')
      .eq('id', concursoId)
      .single();
    
    if (concursoError) throw concursoError;

    // Preparar dados com estrutura consolidada
    const answersArray = answers.map(a => {
      const qNum = a.questionNumber;
      const sectionType = getSectionTypeForQuestion(concurso, qNum);
      
      return {
        questionNumber: qNum,
        answer: a.answer,
        sectionType,
        answerData: {
          objective_answer: a.answer,
          timestamp: new Date().toISOString()
        }
      };
    });
    
    devLog.log('[answerManagement] Dados preparados para estrutura consolidada:', { 
      answersCount: answersArray.length,
      concursoId: concursoId?.substring(0, 8) + '...',
      rankingId: rankingId?.substring(0, 8) + '...'
    });

    // ✅ VALIDAÇÃO: Validar todos os inputs antes de enviar
    let validatedConcursoId: string;
    let validatedBookletId: string | null;
    let validatedAnswers: Record<string, string>;
    let validatedSubjectiveScores: any;
    let validatedEditCount: number;
    
    devLog.log('[answerManagement] Iniciando validação de inputs...');
    
    try {
      devLog.log('[answerManagement] Validando concursoId...');
      validatedConcursoId = RPCValidator.validateUUID(concursoId, 'ID do concurso');
      devLog.log('[answerManagement] concursoId validado:', validatedConcursoId.substring(0, 8) + '...');
      
      devLog.log('[answerManagement] Validando bookletId...');
      validatedBookletId = RPCValidator.validateBookletId('default');
      devLog.log('[answerManagement] bookletId validado:', validatedBookletId);
      
      // Converter respostas para formato JSONB
      devLog.log('[answerManagement] Convertendo respostas para JSONB...');
      const answersObject: { [key: string]: string } = {};
      answersArray.forEach(answer => {
        answersObject[answer.questionNumber.toString()] = answer.answer;
      });
      devLog.log('[answerManagement] Respostas convertidas:', { 
        totalQuestions: Object.keys(answersObject).length,
        sampleKeys: Object.keys(answersObject).slice(0, 5)
      });
      
      validatedAnswers = RPCValidator.validateAnswersJSONB(answersObject);
      devLog.log('[answerManagement] Respostas validadas:', { 
        totalQuestions: Object.keys(validatedAnswers).length 
      });
      
      // Validar pontuações subjetivas
      devLog.log('[answerManagement] Validando pontuações subjetivas...');
      validatedSubjectiveScores = RPCValidator.validateSubjectiveScores({
        discursive: 0,
        case_study_1: 0,
        case_study_2: 0,
        case_study_3: 0
      });
      devLog.log('[answerManagement] Pontuações subjetivas validadas:', validatedSubjectiveScores);
      
      // Validar contador de edições
      devLog.log('[answerManagement] Validando contador de edições...');
      validatedEditCount = RPCValidator.validateEditCount(0);
      devLog.log('[answerManagement] Contador de edições validado:', validatedEditCount);
      
      devLog.log('[answerManagement] ✅ Todas as validações passaram com sucesso');
    } catch (validationError: any) {
      devLog.error('[answerManagement] ❌ ERRO DE VALIDAÇÃO:', {
        message: validationError.message,
        stack: validationError.stack,
        error: validationError
      });
      throw new Error(validationError.message || 'Dados inválidos');
    }

    // Usar a nova função RPC consolidada com dados validados
    const rpcParams = {
      p_concurso_id: validatedConcursoId,
      p_booklet_id: validatedBookletId,
      p_answers: validatedAnswers,
      p_discursive_score: validatedSubjectiveScores.discursive,
      p_case_study_1_score: validatedSubjectiveScores.case_study_1,
      p_case_study_2_score: validatedSubjectiveScores.case_study_2,
      p_case_study_3_score: validatedSubjectiveScores.case_study_3,
      p_current_edit_count: validatedEditCount
    };
    
    devLog.log('[answerManagement] Chamando RPC save_user_answers_with_booklet com parâmetros:', {
      p_concurso_id: rpcParams.p_concurso_id.substring(0, 8) + '...',
      p_booklet_id: rpcParams.p_booklet_id,
      p_answers_count: Object.keys(rpcParams.p_answers).length,
      p_discursive_score: rpcParams.p_discursive_score,
      p_case_study_1_score: rpcParams.p_case_study_1_score,
      p_case_study_2_score: rpcParams.p_case_study_2_score,
      p_case_study_3_score: rpcParams.p_case_study_3_score,
      p_current_edit_count: rpcParams.p_current_edit_count
    });
    
    const { data, error } = await supabase.rpc('save_user_answers_with_booklet', rpcParams);
    
    if (error) {
      devLog.error('[answerManagement] ❌ ERRO na função RPC consolidada:', {
        error: error,
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      throw error;
    }
    
    devLog.log('[answerManagement] ✅ Respostas salvas com sucesso via estrutura consolidada', {
      data: data
    });
    return answersArray;
  } catch (error: any) {
    devLog.error('[answerManagement] Erro ao salvar respostas:', error);
    throw error;
  }
};

// Função para buscar respostas usando estrutura consolidada
export const fetchUserAnswers = async (rankingId: string) => {
  try {
    const { data, error } = await supabase
      .from('user_answers')
      .select('answers_data')
      .eq('user_ranking_id', rankingId)
      .is('question_number', null)
      .single();
      
    if (error) {
      devLog.error('[answerManagement] Error fetching consolidated answers:', error);
      return [];
    }
    
    if (!data?.answers_data) {
      return [];
    }
    
    // Converter estrutura consolidada para formato legado para compatibilidade
    const consolidatedData = data.answers_data;
    const legacyAnswers: any[] = [];
    
    if (consolidatedData.booklets) {
      Object.values(consolidatedData.booklets).forEach((booklet: any) => {
        if (booklet.answers) {
          Object.entries(booklet.answers).forEach(([questionNum, answer]) => {
            legacyAnswers.push({
              user_ranking_id: rankingId,
              question_number: parseInt(questionNum),
              answer: answer
            });
          });
        }
      });
    }
    
    return legacyAnswers;
  } catch (error) {
    devLog.error('[answerManagement] Error fetching user answers:', error);
    return [];
  }
};
