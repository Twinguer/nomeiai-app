// @ts-nocheck
import { supabase } from '@/integrations/supabase/client';
import { devLog, sanitizeForLog } from '@/utils/productionLogger';

export const fetchExistingAnswers = async (rankingId: string, selectedBookletId?: string) => {
  try {
    // Debug logs removed for security
    // Debug logs removed for security

    // Buscar dados do usuário atual
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      devLog.error('[fetchExistingAnswers] Usuário não autenticado');
      return {};
    }

    // Buscar dados consolidados usando user_id
    const { data: rankingData, error: rankingError } = await supabase
      .from('user_rankings')
      .select('consolidated_data')
      .eq('user_id', user.id)
      .maybeSingle();

    if (rankingError || !rankingData) {
      devLog.error('[fetchExistingAnswers] Erro ao buscar dados do ranking:', rankingError);
      return {};
    }

    // Debug logs removed for security

    // Verificar se há dados consolidados
    if (!rankingData.consolidated_data || rankingData.consolidated_data === '{}') {
      // Debug logs removed for security
      return {
        answers: {},
        discursiveScore: null,
        caseStudy1Score: null,
        caseStudy2Score: null,
        caseStudy3Score: null,
        otherSubjectiveScore: null,
        subjectScores: {},
        selectedBooklet: null,
        editCount: 0
      };
    }

    const consolidatedData = rankingData.consolidated_data;
    const userId = user.id;
    
    // Buscar selected_booklet_id da nova estrutura (nível do ranking)
    let selectedBooklet = null;
    if (consolidatedData?.rankings?.[rankingId]?.selected_booklet_id) {
      selectedBooklet = consolidatedData.rankings[rankingId].selected_booklet_id;
    }

    // Debug logs removed for security

    let answers: { [key: number]: string } = {};
    let subjectiveScores = {};

    // NOVA ESTRUTURA: consolidated_data.rankings[rankingId].user_data
    const rankings = consolidatedData.rankings;
    if (rankings) {
      // Encontrar o ranking específico pelo rankingId
      const rankingData = rankings[rankingId];
      if (rankingData?.user_data) {
        // Extrair respostas da estrutura correta: {bookletId: {disciplineType: {questionNumber: answer}}}
        if (rankingData.user_data.answers) {
          // Debug logs removed for security
          // Debug logs removed for security
          
          // A estrutura correta é: answers[bookletId][disciplineType][questionNumber] = answer
          const answersData = rankingData.user_data.answers;
          const selectedBookletId = rankingData.selected_booklet_id;
          
          if (selectedBookletId && answersData[selectedBookletId]) {
            const bookletAnswers = answersData[selectedBookletId];
            // Debug logs removed for security
            
            // Percorrer todas as disciplinas do caderno
            Object.entries(bookletAnswers).forEach(([disciplineType, disciplineAnswers]) => {
              // Debug logs removed for security
              
              // Percorrer todas as questões da disciplina
              Object.entries(disciplineAnswers as Record<string, string>).forEach(([questionNum, answer]) => {
                const questionNumber = parseInt(questionNum);
                if (!isNaN(questionNumber)) {
                  answers[questionNumber] = answer;
                }
              });
            });
          } else {
            // Debug logs removed for security
          }
          
          // Debug logs removed for security
          // Debug logs removed for security
        } else {
          // Debug logs removed for security
        }

        // Extrair pontuações subjetivas da estrutura atual (subjectives, não subjective_scores)
        if (rankingData.user_data.subjectives) {
          subjectiveScores = rankingData.user_data.subjectives;
        }
      }
    }

    // Debug logs removed for security
    // Debug logs removed for security
    // Debug logs removed for security

    // Debug logs removed for security

    return {
      answers,
      discursiveScore: subjectiveScores?.discursive ?? null,
      caseStudy1Score: subjectiveScores?.case_study_1 ?? null,
      caseStudy2Score: subjectiveScores?.case_study_2 ?? null,
      caseStudy3Score: subjectiveScores?.case_study_3 ?? null,
      otherSubjectiveScore: subjectiveScores?.other_subjective ?? null,
      subjectScores: subjectiveScores || {},
      selectedBooklet: selectedBooklet,
      editCount: consolidatedData?.rankings?.[rankingId]?.edit_count || 0,
      consolidatedData: consolidatedData
    };

  } catch (error) {
    devLog.error('[fetchExistingAnswers] Erro geral:', error);
    return {};
  }
};