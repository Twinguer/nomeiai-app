
import { supabase } from '@/integrations/supabase/client';
import { devLog, sanitizeForLog } from '@/utils/productionLogger';

// SECURITY: Scoring logic moved to backend - use Edge Functions

interface RecalculationResponse {
  success: boolean;
  message?: string;
  error?: any;
  updatedScore?: number;
}

type PositionThreshold = 'ampla' | 'cota_racial' | 'pcd';

const isPositionThreshold = (value: string): value is PositionThreshold => {
  return ['ampla', 'cota_racial', 'pcd'].includes(value);
};

export const recalculateUserScore = async (userId: string, concursoId: string): Promise<RecalculationResponse> => {
  try {
    // ✅ REFATORADO: Usar apenas função do backend para cálculo
    // A função calculate_user_score_realtime já faz todos os cálculos e atualiza o banco
    
    // 1. Buscar dados do usuário para obter rankingId e selectedBooklet
    const { data: userRanking, error: userRankingError } = await supabase
      .from('user_rankings')
      .select('user_id, consolidated_data')
      .eq('user_id', userId)
      .maybeSingle();

    if (userRankingError || !userRanking) {
      devLog.error(`[recalculateUserScore] ❌ ERRO ao buscar usuário: Database operation failed`);
      return { 
        success: false, 
        message: 'Erro ao buscar ranking do usuário', 
        error: userRankingError 
      };
    }

    // 2. Buscar o rankingId correto no consolidated_data
    let rankingId: string | null = null;
    let selectedBooklet: string | null = null;
    
    if (userRanking.consolidated_data?.rankings) {
      for (const key in userRanking.consolidated_data.rankings) {
        const ranking = userRanking.consolidated_data.rankings[key];
        if (ranking.concurso_id === concursoId) {
          rankingId = key;
          selectedBooklet = ranking.user_data?.selected_booklet_id || ranking.selected_booklet_id || null;
          break;
        }
      }
    }

    if (!rankingId) {
      devLog.error(`[recalculateUserScore] ❌ Usuário não está participando do concurso`);
      return { 
        success: false, 
        message: 'Usuário não está participando deste concurso'
      };
    }

    if (!selectedBooklet) {
      devLog.error(`[recalculateUserScore] ❌ selectedBooklet não encontrado`);
      return { 
        success: false, 
        message: 'selectedBooklet não encontrado no ranking do usuário'
      };
    }

    // 3. Chamar função do backend que faz todos os cálculos e atualiza o banco
    const { data: calculatedScore, error: calculationError } = await supabase.rpc('calculate_user_score_realtime', {
      p_ranking_id: rankingId,
      p_user_id: userId,
      p_concurso_id: concursoId,
      p_selected_booklet: selectedBooklet
    });

    if (calculationError) {
      devLog.error(`[recalculateUserScore] ❌ ERRO ao chamar função do backend:`, calculationError);
      return { 
        success: false, 
        message: `Erro ao recalcular pontuação: ${calculationError.message}`, 
        error: calculationError 
      };
    }

    // 4. Retornar sucesso com o score calculado
    return { 
      success: true, 
      message: 'Pontuação recalculada com sucesso',
      updatedScore: typeof calculatedScore === 'number' ? calculatedScore : 0
    };
  } catch (error) {
    devLog.error(`[recalculateUserScore] ❌ ERRO GERAL para usuário ${userId}:`, error);
    devLog.error(`[recalculateUserScore] ❌ Stack trace:`, error.stack);
    return { 
      success: false, 
      message: `Erro ao recalcular pontuação: ${error.message}`, 
      error: error 
    };
  }
};

export const getUserRankingPosition = async (
  userId: string,
  concursoId: string,
  cota?: string
): Promise<number | null> => {
  try {
    // Buscar dados do usuário usando consolidated_data
    const { data: userRanking, error: userRankingError } = await supabase
      .from('user_rankings')
      .select('consolidated_data')
      .eq('user_id', userId)
      .maybeSingle();

    if (userRankingError || !userRanking) {
      devLog.error('Erro ao buscar ranking do usuário:', userRankingError);
      return null;
    }

    // Buscar o rankingId correto no consolidated_data
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
      devLog.error('Usuário não está participando deste concurso');
      return null;
    }

    // Obter posição do consolidated_data
    const position = userRanking.consolidated_data.rankings[rankingId].user_data?.position || null;

    // Verificar se a posição está dentro das vagas disponíveis
    const { data: concurso, error: concursoError } = await supabase
      .from('concursos')
      .select('vagas')
      .eq('id', concursoId)
      .single();

    if (concursoError) {
      devLog.error('Erro ao buscar número de vagas:', concursoError);
      return position;
    }

    const vacanciesCount = concurso?.vagas;

    // Verificar se a posição está dentro das vagas disponíveis
    if (cota && isPositionThreshold(cota) && 
        typeof position === 'number' && 
        typeof vacanciesCount === 'number' && 
        position > vacanciesCount) {
      return null;
    }

    return position;
  } catch (error) {
    devLog.error('Erro ao obter posição do usuário:', error);
    return null;
  }
};
