import { SupabaseClient } from '@supabase/supabase-js';
import { devLog, sanitizeForLog } from '@/utils/productionLogger';
import { getReservationAbbreviation, normalizeReservationType } from '@/utils/quotaNormalization';

/**
 * Interface for ranking data item
 */
interface RankingDataItem {
  concurso_id: string;
  user_data?: {
    score?: number;
    reservation_type?: string;
    subjectives?: {
      discursive?: number;
      case_study_1?: number;
      case_study_2?: number;
      case_study_3?: number;
      other_subjective?: number;
    };
    object_scores?: Record<string, number>;
    belowMinimum?: boolean;
    belowDisciplineMinimums?: string[];
    belowBlockMinimums?: string[];
  };
}

/**
 * Interface for consolidated rankings
 */
interface ConsolidatedRankings {
  [rankingId: string]: RankingDataItem;
}

/**
 * Interface for user ranking data
 */
interface UserRankingData {
  user_id: string;
  consolidated_data?: {
    rankings?: ConsolidatedRankings;
  };
}

/**
 * DEPRECATED: Esta função usa a estrutura antiga de user_rankings
 * Use fetchUserRankingsV3 de rankingServiceV3.ts para queries otimizadas
 */
export const getRankingsWithUserInfo = async (supabase: SupabaseClient, concursoId: string) => {
  // ✅ DEPRECATED: Use fetchUserRankings from rankingService.ts (consolidado)
  
  try {
    // Get all user_rankings and filter by concurso_id in consolidated_data
    const { data: allUserRankings, error: rankingError } = await supabase
      .from('user_rankings')
      .select(`
        user_id,
        consolidated_data
      `) as { data: UserRankingData[] | null, error: any };

    if (rankingError) {
      devLog.error("[userRankings] Erro ao buscar user_rankings:", rankingError);
      throw rankingError;
    }

    if (!allUserRankings || allUserRankings.length === 0) {
      return [];
    }
    
    // Filter and format rankings for the specific concurso
    const rankingData = [];
    
    // Get user IDs for profile lookup
    const userIds = allUserRankings.map(ur => ur.user_id);
    
    // Fetch user profiles
    const { data: userProfiles, error: profileError } = await supabase
      .from('users_profiles')
      .select('id, name, avatar_url')
      .in('id', userIds);
    
    if (profileError) {
      devLog.error("[userRankings] Erro ao buscar profiles:", profileError);
    }
    
    // Create a map for quick profile lookup
    const profileMap = new Map();
    if (userProfiles) {
      userProfiles.forEach(profile => {
        profileMap.set(profile.id, profile);
      });
    }
    
    // Process rankings
    for (const userRanking of allUserRankings) {
      if (userRanking.consolidated_data?.rankings) {
        for (const [rankingId, rankingDataItem] of Object.entries(userRanking.consolidated_data.rankings)) {
          const typedRankingData = rankingDataItem as RankingDataItem;
          if (typedRankingData.concurso_id === concursoId) {
            const userProfile = profileMap.get(userRanking.user_id);
            
            if (!userProfile) {
              devLog.warn(`[userRankings] Profile not found for user ${userRanking.user_id}`);
              continue;
            }
            
            rankingData.push({
              id: rankingId,
              position: 0, // Will be calculated later
              name: userProfile.name || 'Usuário',
              score: typedRankingData.user_data?.score || 0,
              userId: userRanking.user_id,
              avatarUrl: userProfile.avatar_url,
              // ✅ CORREÇÃO: Normalizar reservation_type para garantir nomenclatura correta
              reservationType: normalizeReservationType(typedRankingData.user_data?.reservation_type || 'Ampla Concorrência'),
              displayReservation: getReservationAbbreviation(typedRankingData.user_data?.reservation_type || 'Ampla Concorrência'),
              // Pontuações subjetivas (sem peso)
              discursiveScore: typedRankingData.user_data?.subjectives?.discursive || 0,
              caseStudy1Score: typedRankingData.user_data?.subjectives?.case_study_1 || 0,
              caseStudy2Score: typedRankingData.user_data?.subjectives?.case_study_2 || 0,
              caseStudy3Score: typedRankingData.user_data?.subjectives?.case_study_3 || 0,
              otherSubjectiveScore: typedRankingData.user_data?.subjectives?.other_subjective || 0,
              // ✅ CORREÇÃO: Pontuações subjetivas com peso (usar weighted_subjective_scores se disponível)
              weightedDiscursiveScore: typedRankingData.user_data?.weighted_subjective_scores?.weighted_discursive_score || 
                                      typedRankingData.user_data?.weightedSubjectiveScores?.weightedDiscursiveScore || 
                                      typedRankingData.user_data?.subjectives?.discursive || 0,
              weightedCaseStudy1Score: typedRankingData.user_data?.weighted_subjective_scores?.weighted_case_study_1_score || 
                                       typedRankingData.user_data?.weightedSubjectiveScores?.weightedCaseStudy1Score || 
                                       typedRankingData.user_data?.subjectives?.case_study_1 || 0,
              weightedCaseStudy2Score: typedRankingData.user_data?.weighted_subjective_scores?.weighted_case_study_2_score || 
                                       typedRankingData.user_data?.weightedSubjectiveScores?.weightedCaseStudy2Score || 
                                       typedRankingData.user_data?.subjectives?.case_study_2 || 0,
              weightedCaseStudy3Score: typedRankingData.user_data?.weighted_subjective_scores?.weighted_case_study_3_score || 
                                       typedRankingData.user_data?.weightedSubjectiveScores?.weightedCaseStudy3Score || 
                                       typedRankingData.user_data?.subjectives?.case_study_3 || 0,
              weightedOtherSubjectiveScore: typedRankingData.user_data?.weighted_subjective_scores?.weighted_other_subjective_score || 
                                            typedRankingData.user_data?.weightedSubjectiveScores?.weightedOtherSubjectiveScore || 
                                            typedRankingData.user_data?.subjectives?.other_subjective || 0,
              // Pontuações de disciplinas customizadas (sem peso)
              customDisciplineScores: typedRankingData.user_data?.object_scores || {},
              // ✅ CORREÇÃO: Pontuações de disciplinas customizadas com peso (usar weightedCustomDisciplineScores se disponível)
              weightedCustomDisciplineScores: typedRankingData.user_data?.weightedCustomDisciplineScores || 
                                              typedRankingData.user_data?.weighted_object_scores || 
                                              typedRankingData.user_data?.object_scores || {},
              // Flags de eliminação (padrão: não eliminado)
              belowMinimum: typedRankingData.user_data?.belowMinimum || false,
              belowDisciplineMinimums: typedRankingData.user_data?.belowDisciplineMinimums || [],
              belowBlockMinimums: typedRankingData.user_data?.belowBlockMinimums || [],
            });
          }
        }
      }
    }
    
    // Sort by score and calculate positions
    rankingData.sort((a, b) => b.score - a.score);
    rankingData.forEach((ranking, index) => {
      ranking.position = index + 1;
    });
    
    return rankingData;
    
  } catch (error) {
    devLog.error("[userRankings] Error fetching rankings with user info:", error);
    throw error;
  }
};