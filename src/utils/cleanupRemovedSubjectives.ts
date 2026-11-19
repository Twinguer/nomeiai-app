/**
 * Utilitário para limpar pontuações de subjetivas removidas
 * 
 * Este utilitário garante que rankings existentes não mantenham
 * pontuações de subjetivas que foram removidas durante edições.
 */

import { supabase } from '@/integrations/supabase/client';
import { devLog, sanitizeForLog } from '@/utils/productionLogger';

export interface CleanupResult {
  success: boolean;
  message: string;
  cleanedRankings?: number;
  error?: string;
}

/**
 * Limpa pontuações de subjetivas removidas em um ranking específico
 */
export const cleanupRankingSubjectives = async (
  concursoId: string,
  rankingId: string
): Promise<CleanupResult> => {
  try {
    // Buscar dados do concurso para identificar subjetivas ativas
    const { data: concurso, error: concursoError } = await supabase
      .from('concursos')
      .select('subjects')
      .eq('id', concursoId)
      .single();
    
    if (concursoError || !concurso) {
      return {
        success: false,
        message: 'Erro ao buscar dados do concurso',
        error: concursoError?.message
      };
    }
    
    // Identificar subjetivas ativas
    const activeSubjectives = {
      discursive: concurso.subjects?.discr === true,
      case_study_1: concurso.subjects?.case1 === true,
      case_study_2: concurso.subjects?.case2 === true,
      case_study_3: concurso.subjects?.case3 === true,
      other_subjective: concurso.subjects?.other === true
    };
    
    devLog.log('[cleanupRankingSubjectives] Subjetivas ativas:', activeSubjectives);
    
    // Buscar dados do usuário
    const { data: userRanking, error: userError } = await supabase
      .from('user_rankings')
      .select('consolidated_data')
      .eq('user_id', rankingId.split('_')[0]) // Extrair user_id do rankingId
      .single();
    
    if (userError || !userRanking) {
      return {
        success: false,
        message: 'Erro ao buscar dados do usuário',
        error: userError?.message
      };
    }
    
    const consolidatedData = userRanking.consolidated_data;
    const rankingData = consolidatedData?.rankings?.[rankingId];
    
    if (!rankingData) {
      return {
        success: false,
        message: 'Ranking não encontrado',
        error: 'Ranking data not found'
      };
    }
    
    // Limpar subjetivas removidas
    const currentSubjectives = rankingData.user_data?.subjectives || {};
    const cleanedSubjectives = {
      discursive: activeSubjectives.discursive ? (currentSubjectives.discursive || 0) : 0,
      case_study_1: activeSubjectives.case_study_1 ? (currentSubjectives.case_study_1 || 0) : 0,
      case_study_2: activeSubjectives.case_study_2 ? (currentSubjectives.case_study_2 || 0) : 0,
      case_study_3: activeSubjectives.case_study_3 ? (currentSubjectives.case_study_3 || 0) : 0,
      other_subjective: activeSubjectives.other_subjective ? (currentSubjectives.other_subjective || 0) : 0
    };
    
    devLog.log('[cleanupRankingSubjectives] Limpeza realizada:', {
      antes: currentSubjectives,
      depois: cleanedSubjectives
    });
    
    // Atualizar dados no banco
    const updatedConsolidatedData = {
      ...consolidatedData,
      rankings: {
        ...consolidatedData.rankings,
        [rankingId]: {
          ...rankingData,
          user_data: {
            ...rankingData.user_data,
            subjectives: cleanedSubjectives
          }
        }
      }
    };
    
    const { error: updateError } = await supabase
      .from('user_rankings')
      .update({ consolidated_data: updatedConsolidatedData })
      .eq('user_id', rankingId.split('_')[0]);
    
    if (updateError) {
      return {
        success: false,
        message: 'Erro ao atualizar dados',
        error: updateError.message
      };
    }
    
    return {
      success: true,
      message: 'Subjetivas removidas limpas com sucesso',
      cleanedRankings: 1
    };
    
  } catch (error: any) {
    devLog.error('[cleanupRankingSubjectives] Erro:', error);
    return {
      success: false,
      message: 'Erro interno',
      error: error.message
    };
  }
};

/**
 * Limpa pontuações de subjetivas removidas em todos os rankings de um concurso
 */
export const cleanupConcursoSubjectives = async (
  concursoId: string
): Promise<CleanupResult> => {
  try {
    // Buscar todos os rankings do concurso
    const { data: rankings, error: rankingsError } = await supabase
      .from('user_rankings')
      .select('user_id, consolidated_data')
      .not('consolidated_data', 'is', null);
    
    if (rankingsError || !rankings) {
      return {
        success: false,
        message: 'Erro ao buscar rankings',
        error: rankingsError?.message
      };
    }
    
    let cleanedCount = 0;
    
    for (const ranking of rankings) {
      const consolidatedData = ranking.consolidated_data;
      if (!consolidatedData?.rankings) continue;
      
      // Buscar dados do concurso
      const { data: concurso } = await supabase
        .from('concursos')
        .select('subjects')
        .eq('id', concursoId)
        .single();
      
      if (!concurso) continue;
      
      const activeSubjectives = {
        discursive: concurso.subjects?.discr === true,
        case_study_1: concurso.subjects?.case1 === true,
        case_study_2: concurso.subjects?.case2 === true,
        case_study_3: concurso.subjects?.case3 === true,
        other_subjective: concurso.subjects?.other === true
      };
      
      let hasChanges = false;
      const updatedRankings = { ...consolidatedData.rankings };
      
      // Limpar subjetivas em todos os rankings do usuário
      for (const [rankingId, rankingData] of Object.entries(updatedRankings)) {
        if (rankingData.user_data?.subjectives) {
          const currentSubjectives = rankingData.user_data.subjectives;
          const cleanedSubjectives = {
            discursive: activeSubjectives.discursive ? (currentSubjectives.discursive || 0) : 0,
            case_study_1: activeSubjectives.case_study_1 ? (currentSubjectives.case_study_1 || 0) : 0,
            case_study_2: activeSubjectives.case_study_2 ? (currentSubjectives.case_study_2 || 0) : 0,
            case_study_3: activeSubjectives.case_study_3 ? (currentSubjectives.case_study_3 || 0) : 0,
            other_subjective: activeSubjectives.other_subjective ? (currentSubjectives.other_subjective || 0) : 0
          };
          
          // Verificar se houve mudanças
          const hasChangesInRanking = Object.keys(cleanedSubjectives).some(
            key => cleanedSubjectives[key] !== (currentSubjectives[key] || 0)
          );
          
          if (hasChangesInRanking) {
            updatedRankings[rankingId] = {
              ...rankingData,
              user_data: {
                ...rankingData.user_data,
                subjectives: cleanedSubjectives
              }
            };
            hasChanges = true;
            cleanedCount++;
          }
        }
      }
      
      // Atualizar se houve mudanças
      if (hasChanges) {
        const updatedConsolidatedData = {
          ...consolidatedData,
          rankings: updatedRankings
        };
        
        await supabase
          .from('user_rankings')
          .update({ consolidated_data: updatedConsolidatedData })
          .eq('user_id', ranking.user_id);
      }
    }
    
    return {
      success: true,
      message: `Limpeza concluída. ${cleanedCount} rankings atualizados.`,
      cleanedRankings: cleanedCount
    };
    
  } catch (error: any) {
    devLog.error('[cleanupConcursoSubjectives] Erro:', error);
    return {
      success: false,
      message: 'Erro interno',
      error: error.message
    };
  }
};
