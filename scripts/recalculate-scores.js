import { createClient } from '@supabase/supabase-js';

// Configuração do Supabase
// ✅ SEGURANÇA: Usar variáveis de ambiente
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

// Validação obrigatória
if (!supabaseUrl || !supabaseKey) {
  console.error('❌ ERRO: Variáveis de ambiente não configuradas!');
  console.error('Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo .env');
  console.error('Para mais informações, consulte: docs/ENV_SETUP.md');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function recalculateUserScore(userId, concursoId) {
  try {
    console.log(`[recalculateUserScore] Iniciando recálculo para usuário ${userId} no concurso ${concursoId}`);
    
    // Buscar dados do concurso
    const { data: concurso, error: concursoError } = await supabase
      .from('concursos')
      .select('id, disciplines, subjects, exam_type, alternatives_count, official_answers')
      .eq('id', concursoId)
      .single();

    if (concursoError) {
      console.error('Erro ao buscar dados do concurso:', concursoError);
      return { success: false, message: 'Erro ao obter dados do concurso' };
    }

    console.log('Concurso encontrado:', concurso.titulo);

    // Buscar dados do usuário
    const { data: userRanking, error: userRankingError } = await supabase
      .from('user_rankings')
      .select('user_id, consolidated_data')
      .eq('user_id', userId)
      .maybeSingle();

    if (userRankingError || !userRanking) {
      console.error('Erro ao buscar ranking do usuário:', userRankingError);
      return { success: false, message: 'Erro ao buscar ranking do usuário' };
    }

    // Encontrar o rankingId correto
    let rankingId = null;
    if (userRanking.consolidated_data?.rankings) {
      for (const key in userRanking.consolidated_data.rankings) {
        const ranking = userRanking.consolidated_data.rankings[key];
        if (ranking.concurso_id === concursoId) {
          rankingId = key;
          break;
        }
      }
    }

    if (!rankingId) {
      console.error('Usuário não está participando deste concurso');
      return { success: false, message: 'Usuário não está participando deste concurso' };
    }

    console.log('RankingId encontrado:', rankingId);

    // Extrair respostas do usuário
    const rankingData = userRanking.consolidated_data.rankings[rankingId];
    const userAnswers = [];
    
    if (rankingData?.user_data?.answers) {
      const answersData = rankingData.user_data.answers;
      
      for (const blockId in answersData) {
        const blockData = answersData[blockId];
        if (typeof blockData === 'object' && blockData !== null) {
          for (const disciplineType in blockData) {
            const disciplineData = blockData[disciplineType];
            if (typeof disciplineData === 'object' && disciplineData !== null) {
              for (const questionNumber in disciplineData) {
                const questionNum = parseInt(questionNumber);
                if (!isNaN(questionNum)) {
                  userAnswers.push({
                    question_number: questionNum,
                    answer: disciplineData[questionNumber],
                    discipline_type: disciplineType
                  });
                }
              }
            }
          }
        }
      }
    }

    console.log(`Encontradas ${userAnswers.length} respostas do usuário`);

    // Buscar gabarito oficial
    const officialAnswers = concurso.official_answers?.booklets?.default?.answers || 
                           concurso.official_answers?.booklets?.[Object.keys(concurso.official_answers?.booklets || {})[0]]?.answers || {};

    console.log(`Encontradas ${Object.keys(officialAnswers).length} respostas oficiais`);

    // Calcular pontuações
    const disciplineScores = {};
    let totalScore = 0;

    for (const userAnswer of userAnswers) {
      const questionNumberStr = userAnswer.question_number.toString();
      const officialAnswer = officialAnswers[questionNumberStr];

      if (officialAnswer) {
        const isCorrect = officialAnswer.is_nullified === true || userAnswer.answer === officialAnswer.correct_answer;
        const questionWeight = officialAnswer.weight ?? 1;
        const disciplineType = userAnswer.discipline_type;

        if (!disciplineScores[disciplineType]) {
          disciplineScores[disciplineType] = 0;
        }

        if (isCorrect) {
          totalScore += questionWeight;
          disciplineScores[disciplineType] += questionWeight;
          console.log(`Q${userAnswer.question_number}: ${userAnswer.answer} vs ${officialAnswer.correct_answer} - ${isCorrect ? 'CORRETO' : 'ERRADO'} (+${questionWeight})`);
        }
      }
    }

    console.log('Pontuações calculadas:', disciplineScores);
    console.log('Total score:', totalScore);

    // Atualizar no banco
    const updatedConsolidatedData = {
      ...userRanking.consolidated_data,
      rankings: {
        ...userRanking.consolidated_data.rankings,
        [rankingId]: {
          ...userRanking.consolidated_data.rankings[rankingId],
          user_data: {
            ...userRanking.consolidated_data.rankings[rankingId].user_data,
            score: totalScore,
            subject_scores: disciplineScores,
            subject_scores_tot: Object.values(disciplineScores).reduce((sum, score) => sum + score, 0)
          }
        }
      }
    };

    const { error: updateError } = await supabase
      .from('user_rankings')
      .update({
        consolidated_data: updatedConsolidatedData
      })
      .eq('user_id', userId);

    if (updateError) {
      console.error('Erro ao atualizar dados:', updateError);
      return { success: false, message: 'Erro ao atualizar dados' };
    }

    console.log('✅ Dados atualizados com sucesso!');
    return { success: true, message: 'Recálculo concluído com sucesso' };

  } catch (error) {
    console.error('Erro geral:', error);
    return { success: false, message: error.message };
  }
}

// Executar recálculo
async function main() {
  const userId = '46f5c46a-43c7-40a0-84ee-2a1616f912a8';
  const concursoId = '44c3e864-9c12-4f41-9d12-40b2a1273b62';
  
  const result = await recalculateUserScore(userId, concursoId);
  console.log('Resultado:', result);
}

main().catch(console.error);
