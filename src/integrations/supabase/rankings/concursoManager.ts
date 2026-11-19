
import { supabase } from '../client';
import { recalculateAllUserScores } from './userAnswers';
import { devLog, sanitizeForLog } from '@/utils/productionLogger';
import { checkIsPlatformAdmin } from '@/utils/adminRole';

// Function to create a new ranking
export const createRanking = async (rankingData: any) => {
  try {
    // devLog.log('Creating new ranking with data:', rankingData);
    
    // First, check if all required fields are present
    const requiredFields = ['titulo', 'banca'];
    for (const field of requiredFields) {
      if (!rankingData[field]) {
        throw new Error(`Campo obrigatório faltando: ${field}`);
      }
    }
    
    // Create a sanitized data object with only the fields that exist in the database
    const sanitizedData = {
      titulo: rankingData.titulo,
      orgao: rankingData.orgao,
      banca: rankingData.banca,
      created_at: rankingData.created_at,
      vagas: rankingData.vagas,
        inscritos: rankingData.inscritos,
        status: rankingData.status,
      exam_type: rankingData.exam_type,
      alternatives_count: rankingData.alternatives_count,
      link: rankingData.link,
      
      // Add user ID if provided
      created_by_user_id: rankingData.created_by_user_id,
      is_admin_created: rankingData.is_admin_created || false,
      is_admin_update: rankingData.is_admin_update || false,
      
      // Add custom fields
      custom_banca: rankingData.custom_banca,
      predefined_job_title: rankingData.predefined_job_title,
      custom_job_title: rankingData.custom_job_title,
      
      // Add exam structure fields - ensuring boolean values
      has_basic_knowledge: rankingData.has_basic_knowledge === true,
      has_specific_knowledge_1: rankingData.has_specific_knowledge_1 === true,
      has_specific_knowledge_2: rankingData.has_specific_knowledge_2 === true,
      has_specific_knowledge_3: rankingData.has_specific_knowledge_3 === true,
      
      // Add question counts
      basic_knowledge_questions: rankingData.basic_knowledge_questions,
      specific_knowledge_1_questions: rankingData.specific_knowledge_1_questions,
      specific_knowledge_2_questions: rankingData.specific_knowledge_2_questions,
      specific_knowledge_3_questions: rankingData.specific_knowledge_3_questions,
      
      // Add weight fields
      basic_knowledge_weight: rankingData.basic_knowledge_weight,
      specific_knowledge_weight: rankingData.specific_knowledge_weight || rankingData.specific_knowledge_1_weight, // For backward compatibility
      
      // Add reservation quota fields - ensuring boolean values
      has_ampla_concorrencia: rankingData.has_ampla_concorrencia === true,
      has_ppp: rankingData.has_ppp === true,
      has_pcd: rankingData.has_pcd === true,
      has_hipossuficientes: rankingData.has_hipossuficientes === true,
      has_indigenas: rankingData.has_indigenas === true,
      has_transsexuais: rankingData.has_transsexuais === true
    };
    
    // Add additional weight fields if they exist (only objective knowledge weights)
    const weightFields = [
      'specific_knowledge_1_weight',
      'specific_knowledge_2_weight',
      'specific_knowledge_3_weight'
    ];
    
    for (const field of weightFields) {
      if (rankingData[field]) {
        sanitizedData[field] = rankingData[field];
      }
    }
    
    // Insert sanitized data into concursos table
    const { data, error } = await supabase
      .from('concursos')
      .insert(sanitizedData)
      .select();
      
    if (error) {
      devLog.error('Database error creating ranking:', error);
      throw error;
    }
    
    // devLog.log('Ranking created successfully:', data);
    return data;
  } catch (error) {
    devLog.error('Error creating ranking:', error);
    throw error;
  }
};

// Function to update an existing ranking
export const updateRanking = async (rankingId: string, rankingData: any, userId: string) => {
  try {
    // Check if the user has permission to update this ranking
    const { data: rankingCheck, error: checkError } = await supabase
      .from('concursos')
      .select('created_by_user_id, is_admin_created')
      .eq('id', rankingId)
      .single();
      
    if (checkError) {
      throw new Error('Ranking não encontrado');
    }
    
    const isCreator = rankingCheck.created_by_user_id === userId;
    const isAdmin =
      rankingData.is_admin_update === true && (await checkIsPlatformAdmin());

    if (!isAdmin && !isCreator) {
      throw new Error('Você não tem permissão para editar este ranking');
    }
    
    // Store old values for comparison
    const { data: oldData, error: oldDataError } = await supabase
      .from('concursos')
      .select(`
        basic_knowledge_questions,
        specific_knowledge_1_questions,
        specific_knowledge_2_questions,
        specific_knowledge_3_questions,
        basic_knowledge_weight,
        specific_knowledge_weight,
        specific_knowledge_1_weight,
        specific_knowledge_2_weight,
        specific_knowledge_3_weight,
        has_basic_knowledge,
        has_specific_knowledge_1,
        has_specific_knowledge_2,
        has_specific_knowledge_3,
        has_minimum_score,
        total_minimum_score
      `)
      .eq('id', rankingId)
      .single();
    
    if (oldDataError) {
      devLog.error('Error fetching old ranking data:', oldDataError);
    }
    
    // Update the ranking
    const { data, error } = await supabase
      .from('concursos')
      .update(rankingData)
      .eq('id', rankingId)
      .select();
      
    if (error) {
      devLog.error('Database error updating ranking:', error);
      throw error;
    }
    
    // Check if any exam structure or weights have changed
    let structureChanged = false;
    if (oldData) {
      const structureFields = [
        'exam_type',
        'alternatives_count',
        'basic_knowledge_questions',
        'specific_knowledge_1_questions',
        'specific_knowledge_2_questions',
        'specific_knowledge_3_questions',
        'basic_knowledge_weight',
        'specific_knowledge_weight',
        'specific_knowledge_1_weight',
        'specific_knowledge_2_weight',
        'specific_knowledge_3_weight',
        'has_basic_knowledge',
        'has_specific_knowledge_1',
        'has_specific_knowledge_2',
        'has_specific_knowledge_3',
        'has_minimum_score',
        'total_minimum_score'
      ];
      
      for (const field of structureFields) {
        if (rankingData[field] !== undefined && rankingData[field] !== oldData[field]) {
          structureChanged = true;
          // devLog.log(`Field ${field} changed from ${oldData[field]} to ${rankingData[field]}`);
          break;
        }
      }
    }
    
    // If structure changed, recalculate all scores
    if (structureChanged) {
      try {
        devLog.log('Exam structure changed, recalculating all scores');
        await recalculateAllUserScores(rankingId);
      } catch (recalcError) {
        devLog.error('Error recalculating scores after structure change:', recalcError);
        // Don't throw error here, as the update was successful
      }
    }
    
    return data;
  } catch (error) {
    devLog.error('Error updating ranking:', error);
    throw error;
  }
};

// Function to delete a ranking
export const deleteRanking = async (rankingId: string, userId: string, isAdmin: boolean = false) => {
  try {
    // Check if the ranking exists and get its type
    const { data: rankingCheck, error: checkError } = await supabase
      .from('concursos')
      .select('created_by_user_id, is_admin_created, is_general_card')
      .eq('id', rankingId)
      .single();
      
    if (checkError) {
      throw new Error('Ranking não encontrado');
    }
    
    // Allow admins to delete any ranking, or users to delete their own
    const isCreator = rankingCheck.created_by_user_id === userId;
    
    // For admin check, if isAdmin is explicitly set to true, bypass the user check
    if (!isAdmin && !isCreator) {
      throw new Error('Você não tem permissão para excluir este ranking');
    }
    
    // ✅ Se for card geral, buscar todos os cards filhos primeiro
    let allConcursoIds = [rankingId]; // Incluir o card geral também
    
    if (rankingCheck.is_general_card === true) {
      const { data: childCards, error: childError } = await supabase
        .from('concursos')
        .select('id')
        .eq('parent_concurso_id', rankingId);
      
      if (childError) {
        devLog.error('Error fetching child cards:', childError);
      } else if (childCards && childCards.length > 0) {
        // Adicionar IDs dos cards filhos à lista
        allConcursoIds = [rankingId, ...childCards.map(c => c.id)];
      }
    }
    
    // 1. First, get all user_rankings that participate in any of these concursos
    const { data: userRankings, error: userRankingsError } = await supabase
      .from('user_rankings')
      .select('user_id, consolidated_data')
      .not('consolidated_data', 'is', null);
      
    if (userRankingsError) {
      devLog.error('Error fetching user_rankings ids:', userRankingsError);
    }
    
    // Filter user_rankings that have any of these concursos in their consolidated_data
    const relevantUserRankings = userRankings?.filter(ur => {
      if (!ur.consolidated_data?.rankings) return false;
      // Verificar se participa de qualquer um dos concursos (geral ou filhos)
      return allConcursoIds.some(concursoId => 
        ur.consolidated_data?.rankings?.[concursoId]
      );
    }) || [];
    
    const userIds = relevantUserRankings.map(ur => ur.user_id);
    
    // 2. Delete score_calculation_logs for each user_ranking
    if (userIds.length > 0) {
      for (const userId of userIds) {
        const { error: scoreLogsError } = await supabase
          .from('score_calculation_logs')
          .delete()
          .eq('user_ranking_id', userId);
          
        if (scoreLogsError) {
          devLog.error(`Error deleting score_calculation_logs for user ${userId}:`, scoreLogsError);
        }
      }
    }
    
    // 3. user_answers não é mais usado - dados estão em user_rankings consolidated_data
    // A remoção dos dados consolidados é feita automaticamente via CASCADE
    // Debug logs removed for security
    
    // 4. Remove ALL concursos (geral + filhos) from consolidated_data for each user
    for (const userId of userIds) {
      const { data: userRankingData, error: fetchError } = await supabase
        .from('user_rankings')
        .select('consolidated_data')
        .eq('user_id', userId)
        .maybeSingle();
        
      if (!fetchError && userRankingData?.consolidated_data) {
        const updatedData = { ...userRankingData.consolidated_data };
        let hasChanges = false;
        
        // Remover todos os concursos (geral + filhos) do consolidated_data
        if (updatedData.rankings) {
          for (const concursoId of allConcursoIds) {
            if (updatedData.rankings[concursoId]) {
              delete updatedData.rankings[concursoId];
              hasChanges = true;
            }
          }
        }
        
        // Atualizar apenas se houver mudanças
        if (hasChanges) {
          await supabase
            .from('user_rankings')
            .update({ consolidated_data: updatedData })
            .eq('user_id', userId);
        }
      }
    }
    
    // 5. Deletar o card geral (o CASCADE vai deletar os filhos automaticamente)
    const { error } = await supabase.from('concursos').delete().eq('id', rankingId);
      
    if (error) {
      devLog.error('Database error deleting ranking:', error);
      throw error;
    }
    
    return { success: true };
  } catch (error) {
    devLog.error('Error deleting ranking:', error);
    throw error;
  }
};
