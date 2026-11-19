import { supabase } from "@/integrations/supabase/client";
import { Concurso, ConcursoFilter } from "@/types/concursos";
// ✅ CONSOLIDADO: Usar serviço único de rankings
import { fetchUserRankings as fetchRankingsFromService } from '@/modules/rankings';
import { devLog, sanitizeForLog } from '@/utils/productionLogger';
import {
  hasAnyQuotaEnabled,
  normalizeHasCotaStructure,
} from '@/modules/rankings/domain/rankingFormMappers';

/**
 * Helper function para herdar dados do card geral (parent) para cards de cargo
 * Reutilizável tanto para leitura quanto para escrita
 */
export const inheritParentData = async (
  parentConcursoId: string | null,
  currentData: {
    localidades?: string[] | null;
    vagas?: number | null;
    inscritos?: number | null;
  }
): Promise<{
  localidades: string[];
  vagas: number | null;
  inscritos: number | null;
}> => {
  let finalLocalidades = currentData.localidades || [];
  let finalVagas = currentData.vagas;
  let finalInscritos = currentData.inscritos;

  if (parentConcursoId) {
    try {
      const { data: parentData, error: parentError } = await supabase
        .from('concursos')
        .select('localidades, is_unified, vagas, inscritos')
        .eq('id', parentConcursoId)
        .single();
      
      if (!parentError && parentData) {
        // Se não for unificado, herdar localidades do parent se o cargo não tiver próprias
        if (!parentData.is_unified && (!finalLocalidades || !Array.isArray(finalLocalidades) || finalLocalidades.length === 0)) {
          if (parentData.localidades && Array.isArray(parentData.localidades) && parentData.localidades.length > 0) {
            finalLocalidades = parentData.localidades;
          }
        }
        
        // Herdar vagas e inscritos se o cargo não tiver próprios
        if (!finalVagas && parentData.vagas) {
          finalVagas = parentData.vagas;
        }
        if (!finalInscritos && parentData.inscritos) {
          finalInscritos = parentData.inscritos;
        }
      }
    } catch (error) {
      devLog.error('[inheritParentData] Erro ao buscar dados do parent:', error);
      // Continuar com os valores atuais em caso de erro
    }
  }

  return {
    localidades: finalLocalidades,
    vagas: finalVagas,
    inscritos: finalInscritos
  };
};

export const fetchConcursoById = async (id: string): Promise<Concurso | null> => {
  try {
    // devLog.log('[fetchConcursoById] Fetching concurso with ID:', id);
    
    // Nota: Função ensure_ranking_exists não existe mais, removida para simplificar

    // Buscar dados do concurso (estrutura híbrida)
    const { data: rankingData, error: rankingError } = await supabase
      .from("concursos")
      .select("*")
      .eq("id", id)
      .single();

    if (rankingError) {
      devLog.error('[fetchConcursoById] Ranking error:', rankingError);
      
      // Fallback: buscar do concurso original
      const { data: concursoData, error: concursoError } = await supabase
        .from("concursos")
        .select("*")
        .eq("id", id)
        .single();

      if (concursoError) {
        devLog.error('[fetchConcursoById] Concurso error:', concursoError);
        
        if (concursoError.code === 'PGRST116') {
          throw new Error(`Concurso com ID ${id} não encontrado`);
        }
        
        throw new Error(`Erro ao buscar concurso: ${concursoError.message}`);
      }

      if (!concursoData) {
        throw new Error(`Concurso com ID ${id} não encontrado`);
      }

      devLog.log('[fetchConcursoById] Concurso found (fallback):', concursoData);
      return concursoData;
    }

    if (!rankingData) {
      throw new Error(`Ranking com ID ${id} não encontrado`);
    }


    // Buscar disciplinas do JSONB disciplines na tabela concursos
    const disciplines = rankingData?.disciplines || [];

    // ✅ HERDAR DADOS DO PARENT: Usar função helper para evitar duplicação de código
    const inheritedData = await inheritParentData(rankingData.parent_concurso_id || null, {
      localidades: rankingData.localidades,
      vagas: rankingData.vagas,
      inscritos: rankingData.inscritos
    });

    // ✅ Verificar se o parent é unificado (para exibir state_uf corretamente)
    let parentIsUnified = false;
    let parentIsShowcase = false;
    let parentHasCota = null;
    if (rankingData.parent_concurso_id) {
      try {
        const { data: parentData } = await supabase
          .from('concursos')
          .select('is_unified, is_showcase, has_cota')
          .eq('id', rankingData.parent_concurso_id)
          .single();
        parentIsUnified = parentData?.is_unified || false;
        parentIsShowcase = parentData?.is_showcase || false;
        parentHasCota = parentData?.has_cota || null;
      } catch (error) {
        devLog.error('[fetchConcursoById] Erro ao verificar dados do parent:', error);
      }
    }

    const ownHasCota = normalizeHasCotaStructure(rankingData.has_cota);
    const inheritedHasCota = normalizeHasCotaStructure(parentHasCota);
    const resolvedHasCota = hasAnyQuotaEnabled(ownHasCota) ? ownHasCota : inheritedHasCota;

    // Converter ranking para formato de concurso
    // devLog.log('[fetchConcursoById] Criando concursoData com disciplines:', disciplines);
    // devLog.log('[fetchConcursoById] rankingData.disciplines original:', rankingData.disciplines);
    // devLog.log('[fetchConcursoById] ===== DADOS DO CRIADOR =====');
    // devLog.log('[fetchConcursoById] rankingData.created_by_user_id:', rankingData.created_by_user_id);
    // devLog.log('[fetchConcursoById] rankingData.is_admin_created:', rankingData.is_admin_created);
    
    const concursoData: Concurso = {
      id: rankingData.id,
      titulo: rankingData.titulo,
      orgao: rankingData.orgao,
      banca: rankingData.banca,
      created_at: rankingData.created_at,
      status: rankingData.status,
      updated_at: rankingData.updated_at,
      link: rankingData.descricao,
      inscritos: inheritedData.inscritos || rankingData.inscritos || rankingData.total_participants,
      vagas: inheritedData.vagas || rankingData.vagas,
      knowledgeAreas: null,
      localidades: inheritedData.localidades,
      custom_banca: null,
      is_admin_created: rankingData.is_admin_created,
      created_by_user_id: rankingData.created_by_user_id,
      has_custom_knowledge: true,
      exam_type: rankingData.exam_type,
      alternatives_count: 5,
      predefined_job_title: null,
      custom_job_title: null,
      // Campos de hierarquia
      parent_concurso_id: rankingData.parent_concurso_id || null,
      is_general_card: rankingData.is_general_card || false,
      cargo: rankingData.cargo || null,
      // ✅ Se for card de cargo, usar is_unified do parent; caso contrário, usar do próprio card
      is_unified: rankingData.parent_concurso_id ? parentIsUnified : (rankingData.is_unified || false),
      state_uf: rankingData.state_uf || null,
      has_cota: resolvedHasCota,
      is_admin_update: false,
      // ✅ Herdar is_showcase do parent se for cargo, senão usar do próprio ranking
      is_showcase: rankingData.parent_concurso_id ? parentIsShowcase : (rankingData.is_showcase || false),
      disciplines: disciplines, // Usar disciplinas já convertidas
      has_basic_knowledge: false,
      has_specific_knowledge_1: false,
      has_specific_knowledge_2: false,
      has_specific_knowledge_3: false,
      // Estrutura JSONB para disciplinas subjetivas
      subjects: rankingData.subjects || {
        discr: false,
        case1: false,
        case2: false,
        case3: false,
        other: false,
        name_other: null,
        discr_min_score: 0,
        case1_min_score: 0,
        case2_min_score: 0,
        case3_min_score: 0,
        other_min_score: 0
      },
      // Manter campos individuais para compatibilidade
      has_discursive: rankingData.subjects?.discr || false,
      has_case_study_1: rankingData.subjects?.case1 || false,
      has_case_study_2: rankingData.subjects?.case2 || false,
      has_case_study_3: rankingData.subjects?.case3 || false,
      has_other_subjective: rankingData.subjects?.other || false,
      other_subjective_name: rankingData.subjects?.name_other || null,
      // Notas mínimas para questões subjetivas
      discursive_minimum_score: rankingData.subjects?.discr_min_score || 0,
      case_study_1_minimum_score: rankingData.subjects?.case1_min_score || 0,
      case_study_2_minimum_score: rankingData.subjects?.case2_min_score || 0,
      case_study_3_minimum_score: rankingData.subjects?.case3_min_score || 0,
      other_subjective_minimum_score: rankingData.subjects?.other_min_score || 0,
      basic_knowledge_questions: 0,
      specific_knowledge_1_questions: 0,
      specific_knowledge_2_questions: 0,
      specific_knowledge_3_questions: 0,
      basic_knowledge_weight: 0,
      specific_knowledge_1_weight: 0,
      specific_knowledge_2_weight: 0,
      specific_knowledge_3_weight: 0,
      custom_knowledge_questions: 0,
      custom_knowledge_weight: 0,
      has_minimum_score: rankingData.has_minimum_score,
      minimum_score_unit_type: null,
      total_minimum_score: rankingData.total_minimum_score,
      // Gabarito e ranking provisório
      gabarito_status: rankingData.gabarito_status as Concurso['gabarito_status'],
      recalc_pending_at: rankingData.recalc_pending_at ?? null,
      provisional_version: rankingData.provisional_version ?? 0,
      // has_quota_minimum_score: removida - dados agora em JSONB
      // quota_minimum_score: removida - dados agora em JSONB
      // quota_minimum_score_unit_type: removida - dados agora em JSONB
    };

    // devLog.log('[fetchConcursoById] Ranking converted to concurso:', concursoData);
    // devLog.log('[fetchConcursoById] FINAL disciplines being returned:', concursoData.disciplines);
    // devLog.log('[fetchConcursoById] FINAL has_custom_knowledge:', concursoData.has_custom_knowledge);
    // devLog.log('[fetchConcursoById] FINAL has_basic_knowledge:', concursoData.has_basic_knowledge);
    // devLog.log('[fetchConcursoById] ===== DADOS FINAIS DO CRIADOR =====');
    // devLog.log('[fetchConcursoById] FINAL created_by_user_id:', concursoData.created_by_user_id);
    // devLog.log('[fetchConcursoById] FINAL is_admin_created:', concursoData.is_admin_created);
    return concursoData;
  } catch (error: any) {
    devLog.error('[fetchConcursoById] Error:', error);
    throw error;
  }
};

export const fetchConcursos = async (filters?: ConcursoFilter): Promise<Concurso[]> => {
  try {
    let query = supabase
      .from("concursos")
      .select("*");
    
    // Add filters if provided
    if (filters) {
      // Filter by status if provided
      if (filters.status && filters.status !== 'Todos') {
        query = query.eq('status', filters.status);
      }
      
      // Filter by orgao if provided
      if (filters.orgao && filters.orgao !== 'Todos') {
        query = query.eq('orgao', filters.orgao);
      }
      
      // Filter by banca if provided
      if (filters.banca && filters.banca !== 'Todos') {
        query = query.eq('banca', filters.banca);
      }
    }
    
    // Order by most recent first
    query = query.order('created_at', { ascending: false });
    
    const { data, error } = await query;
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    devLog.error('Error fetching concursos:', error);
    return [];
  }
};

export const getParticipantCount = async (concursoId: string): Promise<number> => {
  try {
    // ✅ CORRIGIDO: Função atualizada para usar estrutura JSONB corretamente
    const { data, error } = await supabase.rpc('count_concurso_participants', {
      concurso_id: concursoId
    });

    if (error) throw error;
    return data || 0;
  } catch (error) {
    devLog.error('Error fetching participant count:', error);
    return 0;
  }
};

export const fetchUserConcursoRankings = async (userId: string) => {
  try {
    const { data, error } = await supabase
      .from('user_rankings')
      .select(`
        id,
        score,
        concurso_id,
        concursos (
          id,
          titulo,
          orgao,
          banca,
          status,
          created_at,
          status
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Map each item individually and access the nested properties correctly
    return data?.map(item => {
      // Safely access the nested concursos object with type assertion
      const concurso = item.concursos as {
        id?: string;
        titulo?: string; 
        orgao?: string;
        banca?: string;
        status?: string;
        created_at?: string;
      } || {};
      
      return {
        id: item.concurso_id,
        rankingId: item.id,
        score: item.score,
        titulo: concurso.titulo || '',
        orgao: concurso.orgao || '',
        banca: concurso.banca || '',
          status: concurso.status || '',
          created_at: concurso.created_at || ''
      };
    }) || [];
  } catch (error) {
    devLog.error('Error fetching user concurso rankings:', error);
    return [];
  }
};

// This function can reuse the fetchUserConcursoRankings
export const fetchUserRankings = async (userId: string) => {
  return fetchUserConcursoRankings(userId);
};

// More functions can be added here as needed...
