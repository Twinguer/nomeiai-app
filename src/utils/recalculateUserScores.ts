import { supabase } from '@/integrations/supabase/client';
import { recalculateUserScore } from '@/integrations/supabase/rankings/rankingMutations';
import { devLog, sanitizeForLog } from '@/utils/productionLogger';

export const recalculateAllUserScores = async (concursoId: string) => {
  try {
    // Debug logs removed for security
    
    // Buscar todos os usuários que participam deste concurso
    const { data: userRankings, error: userRankingsError } = await supabase
      .from('user_rankings')
      .select('user_id, consolidated_data')
      .not('consolidated_data', 'is', null);

    if (userRankingsError) {
      devLog.error('Erro ao buscar user_rankings:', userRankingsError);
      return;
    }

    devLog.log(`[recalculateAllUserScores] Encontrados ${userRankings.length} usuários`);

    // Filtrar usuários que participam do concurso específico
    const usersInConcurso = userRankings.filter(userRanking => {
      const rankings = userRanking.consolidated_data?.rankings || {};
      return Object.values(rankings).some((ranking: any) => ranking.concurso_id === concursoId);
    });

    // Executar recálculo para cada usuário
    for (const userRanking of usersInConcurso) {
      try {
        const result = await recalculateUserScore(userRanking.user_id, concursoId);
        
        if (result.success) {
          devLog.log(`[recalculateAllUserScores] ✅ Recálculo concluído com sucesso`);
        } else {
          devLog.error(`[recalculateAllUserScores] ❌ Erro no recálculo:`, result.message);
        }
      } catch (error) {
        devLog.error(`[recalculateAllUserScores] Erro ao recalcular usuário:`, error);
      }
    }
  } catch (error) {
    devLog.error('[recalculateAllUserScores] Erro geral:', error);
  }
};

export const recalculateSpecificUserScore = async (userId: string, concursoId: string) => {
  try {
    // Debug logs removed for security
    
    // Debug logs removed for security
    const result = await recalculateUserScore(userId, concursoId);
    devLog.log(`[recalculateSpecificUserScore] 📊 Resultado do recalculateUserScore:`, result);
    
    if (result.success) {
      // Debug logs removed for security
      return result;
    } else {
      devLog.error(`[recalculateSpecificUserScore] ❌ Erro para usuário ${userId}:`, result.message);
      return result;
    }
  } catch (error) {
    devLog.error(`[recalculateSpecificUserScore] ❌ Erro ao recalcular usuário ${userId}:`, error);
    devLog.error(`[recalculateSpecificUserScore] ❌ Stack trace:`, error.stack);
    return { success: false, message: error.message };
  }
};
