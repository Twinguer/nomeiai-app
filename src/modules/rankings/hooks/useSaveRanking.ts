
import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from '@tanstack/react-query';
import { mapFormDataToDisciplinesStructure } from '@/utils/disciplinesStructure';
import { recalculateUserScore } from '@/integrations/supabase/rankings/rankingMutations';
import { inheritParentData } from '@/services/concursoService';
import { devLog } from '@/utils/productionLogger';
import {
  createSubjectsStructure,
  ensureNumeric,
  normalizeRankingIdentity,
  resolveHasCotaStructure,
} from '@/modules/rankings/domain/rankingFormMappers';
import type { SaveRankingResult } from '@/modules/rankings/domain/saveRankingResult';

interface SaveRankingOptions {
  formValues: any;
  userId: string;
  editId?: string | null;
  jobTitles: Array<{ id: string; title: string }>;
}

export const useSaveRanking = () => {
  const queryClient = useQueryClient();
  
  const saveRanking = useCallback(async ({ formValues, userId, editId, jobTitles }: SaveRankingOptions): Promise<SaveRankingResult> => {
    try {
      // Se estivermos editando, buscar dados existentes primeiro para preservar estrutura
      let existingDisciplines: any[] = [];
      let existingHasCota: Record<string, unknown> | null = null;
      let examType: string = 'Alternativas';
      
      if (editId) {
        const { data: existingRanking, error: fetchError } = await supabase
          .from('concursos')
          .select('disciplines, exam_type, has_cota')
          .eq('id', editId)
          .single();
        
        if (!fetchError && existingRanking) {
          if (existingRanking.disciplines) {
            existingDisciplines = existingRanking.disciplines;
          }
          existingHasCota = existingRanking.has_cota || null;
          examType = existingRanking.exam_type || 'Alternativas';
        }
      } else {
        examType = formValues.exam_type || 'Alternativas';
      }

      // Normalize strings for uniqueness check (handling case and spaces)
      const normalize = normalizeRankingIdentity;

      // Truncate long titles for better display
      let title = formValues.custom_job_title || formValues.predefined_job_title;
      if (title && title.length > 30) {
        title = title.substring(0, 30) + '...';
      }
      
      // Truncate long orgão for better display
      let orgao = formValues.orgao;
      if (orgao && orgao.length > 30) {
        orgao = orgao.substring(0, 30) + '...';
      }

      // Explicitly convert numeric fields to ensure proper types
      formValues.alternatives_count = ensureNumeric(formValues.alternatives_count);
      
      // Minimum score fields
      if (formValues.has_minimum_score) {
        formValues.total_minimum_score = ensureNumeric(formValues.total_minimum_score);
      } else {
        formValues.total_minimum_score = 0;
      }
      
      // Coluna has_quota_minimum_score foi removida - dados agora em JSONB
      formValues.quota_minimum_score = 0;

      // Don't force custom knowledge mode - let the form values determine this
      
      // Se estamos editando e temos disciplinas existentes, preservar a estrutura
      if (editId && existingDisciplines.length > 0 && formValues.disciplines) {
        // Log removido por segurança
        
        // Verificar se as disciplinas atuais e existentes usam a estrutura de blocos
        const hasCurrBlocks = formValues.disciplines.length > 0 && 
                              'name' in formValues.disciplines[0] && 
                              'disciplines' in formValues.disciplines[0];
        
        const hasExistingBlocks = existingDisciplines.length > 0 && 
                                'name' in existingDisciplines[0] && 
                                'disciplines' in existingDisciplines[0];
        
        // Se ambas têm estrutura de bloco, preservar IDs
        if (hasCurrBlocks && hasExistingBlocks) {
          formValues.disciplines = formValues.disciplines.map((block: any, blockIdx: number) => {
            // Procurar bloco correspondente por índice ou nome
            const existingBlock = existingDisciplines[blockIdx] || 
                                existingDisciplines.find((b: any) => b.name === block.name);
            
            if (existingBlock && existingBlock.id) {
              // Preservar id do bloco
              const updatedBlock = { ...block, id: existingBlock.id };
              
              // Processar disciplinas dentro do bloco
              if (block.disciplines && Array.isArray(block.disciplines) && 
                  existingBlock.disciplines && Array.isArray(existingBlock.disciplines)) {
                updatedBlock.disciplines = block.disciplines.map((discipline: any, discIdx: number) => {
                  // Procurar disciplina correspondente por índice, nome ou tipo
                  const existingDiscipline = existingBlock.disciplines[discIdx] ||
                                          existingBlock.disciplines.find((d: any) => 
                                            d.name === discipline.name || d.type === discipline.type
                                          );
                  
                  if (existingDiscipline && existingDiscipline.id) {
                    // Preservar id da disciplina
                    return {
                      ...discipline,
                      id: existingDiscipline.id,
                      type: discipline.type || existingDiscipline.type // Manter type também para consistência
                    };
                  }
                  
                  return discipline;
                });
              }
              
              return updatedBlock;
            }
            
            return block;
          });
          
          // Log removido por segurança
        }
      }

      // Processar os blocos de disciplinas - SEMPRE usar estrutura hierárquica
      if (formValues.disciplines && Array.isArray(formValues.disciplines)) {
        // Verificar se estamos lidando com a estrutura de blocos
        if (formValues.disciplines.length > 0 && 'name' in formValues.disciplines[0] && 'disciplines' in formValues.disciplines[0]) {
          // Estrutura hierárquica - processar e adicionar metadados do bloco às disciplinas
          formValues.disciplines.forEach((block: any, index: number) => {
            if (block.disciplines && Array.isArray(block.disciplines)) {
              block.disciplines.forEach((discipline: any) => {
                // Adicionar informações do bloco à disciplina
                discipline.blockId = block.id;
                discipline.blockName = block.name;
                discipline.blockWeight = block.weight || 1;
                discipline.blockMinimumScore = ensureNumeric(block.minimum_score);
                discipline.minimum_score = ensureNumeric(discipline.minimum_score);
              });
            }
          });
        }
      }
      
      // Ensure disciplines is a valid array
      if (!formValues.disciplines || !Array.isArray(formValues.disciplines)) {
        formValues.disciplines = [];
      }

      if (formValues.flattenedDisciplines && formValues.flattenedDisciplines.length > 0) {
        formValues.flattenedDisciplines = formValues.flattenedDisciplines.map((discipline: any) => {
          const enabled = discipline.isEnabled === true;
          return {
            ...discipline,
            questionCount: ensureNumeric(discipline.questionCount),
            weight: ensureNumeric(discipline.weight),
            isEnabled: enabled,
            minimum_score: ensureNumeric(discipline.minimum_score)
          };
        });
      }
      
      // Determinar tipo de ranking e campos de hierarquia (disponível para create e update)
      // ✅ PRIORIDADE: Se tem parent_concurso_id, é card de cargo (não importa o ranking_type)
      const hasParent = !!formValues.parent_concurso_id;
      const rankingType = hasParent ? 'position' : (formValues.ranking_type || 'general');
      const isGeneralCard = !hasParent && (rankingType === 'general' || formValues.is_general_card === true);

      // Fetch rankings and do the comparison in JS for robust uniqueness
      // ✅ Incluir campos de hierarquia para comparação correta
      const { data: founds, error: findError } = await supabase
        .from('concursos')
        .select('id, titulo, orgao, banca, created_at, is_general_card, parent_concurso_id, cargo');

      if (findError) throw findError;

      // Don't check for duplicates when editing as admin
      const isAdminEditing = editId && formValues.is_admin_update;
      
      // ✅ Lógica de duplicata ajustada para hierarquia:
      // - Cards gerais não devem ser comparados com cards de cargo
      // - Cards de cargo devem comparar também o campo 'cargo'
      const isDuplicate = !editId && !isAdminEditing && founds?.some(item => {
        // Comparar título, órgão e banca
        const sameBasicInfo = 
          normalize(item.titulo) === normalize(title) &&
          normalize(item.orgao) === normalize(orgao) &&
          normalize(item.banca) === normalize(formValues.custom_banca || formValues.banca);
        
        if (!sameBasicInfo) return false;
        
        // Se estamos criando um card geral, só comparar com outros cards gerais
        if (isGeneralCard) {
          return item.is_general_card === true;
        }
        
        // Se estamos criando um card de cargo, só comparar com outros cards de cargo
        // E também verificar se o cargo é o mesmo
        if (hasParent) {
          const itemIsPositionCard = !!item.parent_concurso_id;
          if (!itemIsPositionCard) return false; // Ignorar cards gerais
          
          // Comparar também o cargo (normalizado)
          const itemCargo = item.cargo || '';
          const newCargo = formValues.cargo || '';
          return normalize(itemCargo) === normalize(newCargo);
        }
        
        // Fallback para cards antigos (sem hierarquia)
        return true;
      });

      if (isDuplicate) {
        return {
          duplicated: true,
          message: hasParent
            ? 'Já existe um ranking de cargo com mesmo título, órgão, banca e cargo.'
            : 'Já existe um ranking com mesmo título, órgão e banca.',
        };
      }
      // ✅ Usar hasParent diretamente para garantir que parent_concurso_id seja preservado
      const parentConcursoId = hasParent ? formValues.parent_concurso_id : null;
      const cargo = hasParent ? formValues.cargo : null;
      // is_unified só é definido no card geral; para card de cargo, sempre false (herda do parent)
      const isUnified = isGeneralCard ? (formValues.is_unified || false) : false;
      // state_uf só é usado para card de cargo em concurso unificado
      const stateUf = hasParent ? formValues.state_uf : null;

      // Se for card de cargo, herdar dados do parent
      let finalTitle = title;
      let finalOrgao = orgao;
      let finalBanca = formValues.custom_banca || formValues.banca;
      
      // ✅ USAR FUNÇÃO HELPER para herdar localidades, vagas e inscritos (evita duplicação)
      const inheritedData = !isGeneralCard && parentConcursoId
        ? await inheritParentData(parentConcursoId, {
            localidades: formValues.localidades,
            vagas: formValues.vagas,
            inscritos: formValues.inscritos
          })
        : {
            localidades: formValues.localidades || [],
            vagas: formValues.vagas,
            inscritos: formValues.inscritos
          };
      
      let parentHasCota: Record<string, unknown> | null = null;

      // Herdar título, órgão, banca e cotas do parent (apenas para cards de cargo)
      if (!isGeneralCard && parentConcursoId) {
        try {
          const { data: parentData, error: parentError } = await supabase
            .from('concursos')
            .select('titulo, orgao, banca, has_cota')
            .eq('id', parentConcursoId)
            .single();
          
          if (!parentError && parentData) {
            finalTitle = parentData.titulo || title;
            finalOrgao = parentData.orgao || orgao;
            finalBanca = parentData.banca || finalBanca;
            parentHasCota = parentData.has_cota || null;
          }
        } catch (error) {
          devLog.error('Erro ao buscar dados do parent:', error);
        }
      }

      const hasCotaStructure = resolveHasCotaStructure({
        formValues,
        existingHasCota,
        parentHasCota,
      });

      // Create a clean object with the data for submission (only essential fields)
      const dataToSubmit: Record<string, any> = {
        titulo: finalTitle,
        orgao: finalOrgao,
        banca: finalBanca,
        status: formValues.status || 'Ativo',
        created_by_user_id: userId,
        // Campos básicos do concurso (usar dados herdados se disponíveis)
        vagas: ensureNumeric(inheritedData.vagas || formValues.vagas),
        inscritos: ensureNumeric(inheritedData.inscritos || formValues.inscritos),
        etapa_atual: formValues.etapa_atual,
        link: formValues.link,
        watermark_image_url: formValues.watermark_image_url || null,
        // Campos de hierarquia
        is_general_card: isGeneralCard,
        parent_concurso_id: parentConcursoId,
        cargo: cargo,
        is_unified: isUnified,
        state_uf: stateUf,
        // Campos de localidade (usar dados herdados)
        localidades: inheritedData.localidades
        // Pontuações mínimas agora vão dentro da estrutura disciplines
      };

      // Remove any temporary fields not needed in database
      // (não há mais campos temporários para remover)

      // Add admin flags if provided
      if (formValues.is_admin_created !== undefined) {
        dataToSubmit.is_admin_created = formValues.is_admin_created;
      }
      
      if (formValues.is_admin_update !== undefined) {
        dataToSubmit.is_admin_update = formValues.is_admin_update;
      }

      // Log removido por segurança

      let result;
      let concursoIdToUse = editId;

      if (editId) {
        // Para edição, incluir todos os campos necessários
        const subjectsStructure = createSubjectsStructure(formValues);
        
        // Processar estrutura de disciplinas para edição usando helper
        const disciplinesStructure = mapFormDataToDisciplinesStructure({
          disciplines: formValues.disciplines || [],
          minimum_total_score: formValues.minimumTotalScore || 0,
          minimum_total_score_cotas: formValues.minimumTotalScoreCotas || 0,
          wrong_answer_penalty: formValues.wrong_answer_penalty || 0
        });
        
        const editDataToSubmit = {
          ...dataToSubmit,
          // Campos básicos do concurso (usar dados herdados se disponíveis)
          vagas: ensureNumeric(inheritedData.vagas || formValues.vagas),
          inscritos: ensureNumeric(inheritedData.inscritos || formValues.inscritos),
          etapa_atual: formValues.etapa_atual,
          link: formValues.link,
          watermark_image_url: formValues.watermark_image_url || null,
          // Campos de hierarquia
          is_general_card: isGeneralCard,
          parent_concurso_id: parentConcursoId,
          cargo: cargo,
          is_unified: isUnified,
          state_uf: stateUf,
          // Campos de localidade e cotas (usar dados herdados)
          localidades: inheritedData.localidades,
          // Campos de configuração de exame
          exam_type: formValues.exam_type || 'Alternativas',
          alternatives_count: ensureNumeric(formValues.alternatives_count),
          // Campos de disciplinas - sempre usar estrutura hierárquica
          disciplines: disciplinesStructure,
          subjects: subjectsStructure,
          has_cota: hasCotaStructure,
          form_config: formValues.form_config || {},
          official_answers: formValues.official_answers || {},
          ...(formValues.exam_booklets && formValues.exam_booklets.length > 0 ? { exam_booklets: formValues.exam_booklets } : {}),
          metadata: formValues.metadata || {}
        };

        const { data, error } = await supabase
          .from('concursos')
          .update(editDataToSubmit)
          .eq('id', editId)
          .select();

        if (error) {
          devLog.error("Error updating ranking:", error);
          throw error;
        }
        result = data;
        concursoIdToUse = editId;
        
        // devLog.log('[useSaveRanking] Ranking editado com sucesso, campos atualizados:', Object.keys(editDataToSubmit));
      } else {
        const { data, error } = await supabase
          .from('concursos')
          .insert(dataToSubmit)
          .select();
          
        if (error) {
          devLog.error("Error inserting ranking:", error);
          throw error;
        }
        result = data;
        concursoIdToUse = result?.[0]?.id;
      }

      const recalculateParticipants = async (concursoId: string) => {
        try {
          const { data: allUserRankings } = await supabase
            .from('user_rankings')
            .select('user_id, consolidated_data');

          const participants: string[] = [];
          if (allUserRankings && Array.isArray(allUserRankings)) {
            for (const ur of allUserRankings) {
              const rankingsMap = ur?.consolidated_data?.rankings || {};
              const keys = Object.keys(rankingsMap);
              const participates = keys.some((k) => rankingsMap[k]?.concurso_id === concursoId);
              if (participates) participants.push(ur.user_id);
            }
          }

          if (participants.length > 0) {
            Promise.allSettled(participants.map((uid) => recalculateUserScore(uid, concursoId)))
              .then(() => {
                queryClient.invalidateQueries({ queryKey: ['rankings', concursoId] });
                queryClient.invalidateQueries({ queryKey: ['user-created-rankings'] });
              })
              .catch((e) => devLog.error('[useSaveRanking] Erro ao executar recálculo em lote:', e));
          }
        } catch (batchErr) {
          devLog.error('[useSaveRanking] Erro ao preparar recálculo pós-edição:', batchErr);
        }
      };

      if (concursoIdToUse) {
        if (!editId) {
          const disciplinesStructure = mapFormDataToDisciplinesStructure({
            ...formValues,
            minimum_total_score: formValues.minimumTotalScore || 0,
            minimum_total_score_cotas: formValues.minimumTotalScoreCotas || 0,
            wrong_answer_penalty: formValues.wrong_answer_penalty || 0
          });

          const { error: updateError } = await supabase
            .from('concursos')
            .update({
              exam_type: formValues.exam_type || 'Alternativas',
              created_by_user_id: formValues.created_by_user_id || userId,
              vagas: ensureNumeric(inheritedData.vagas || formValues.vagas),
              inscritos: ensureNumeric(inheritedData.inscritos || formValues.inscritos),
              etapa_atual: formValues.etapa_atual,
              link: formValues.link,
              watermark_image_url: formValues.watermark_image_url || null,
              is_general_card: isGeneralCard,
              parent_concurso_id: parentConcursoId,
              cargo: cargo,
              is_unified: isUnified,
              state_uf: stateUf,
              localidades: inheritedData.localidades,
              disciplines: disciplinesStructure,
              subjects: createSubjectsStructure(formValues),
              has_cota: hasCotaStructure,
              form_config: formValues.form_config || {},
              official_answers: formValues.official_answers || {},
              ...(formValues.exam_booklets && formValues.exam_booklets.length > 0 ? { exam_booklets: formValues.exam_booklets } : {}),
              metadata: formValues.metadata || {},
              total_participants: 0
            })
            .eq('id', concursoIdToUse);

          if (updateError) {
            devLog.error("Error updating additional fields:", updateError);
            throw updateError;
          }
        } else {
          await recalculateParticipants(concursoIdToUse);
        }
      }

      // Show success message and invalidate queries
      queryClient.invalidateQueries({ queryKey: ['rankings'] });
      queryClient.invalidateQueries({ queryKey: ['concursos'] });
      queryClient.invalidateQueries({ queryKey: ['concurso', concursoIdToUse] });
      queryClient.invalidateQueries({ queryKey: ['participant-count-v2', concursoIdToUse] });
      queryClient.invalidateQueries({ queryKey: ['user-participation-v2', concursoIdToUse] });
      queryClient.invalidateQueries({ queryKey: ['user-created-rankings', userId] });
      
      return { id: concursoIdToUse!, duplicated: false };
    } catch (error: any) {
      devLog.error("Erro ao salvar ranking:", error);
      return {
        error: true,
        message: `Erro ao salvar ranking: ${error?.message || 'Erro desconhecido'}`,
      };
    }
  }, [queryClient]);

  return { saveRanking };
};
