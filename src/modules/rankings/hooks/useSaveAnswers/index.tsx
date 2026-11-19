
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { recalculateUserScore } from '@/integrations/supabase/rankings/rankingMutations';
import { UseSaveAnswersProps, SaveAnswersResponse } from './types';
import { validateSaveAnswers } from './validation';
import { prepareAnswersData } from './prepareData';
import { rankingCache } from '@/modules/rankings/services/rankingCache';
import { migrateObjectScores, createInitialObjectScores } from '@/utils/consolidatedDataMapper';
import { useSubscription } from '@/modules/payments';
import { useNavigate } from 'react-router-dom';
import { showProRequiredToast } from '@/utils/planRestrictions';
import { devLog, sanitizeForLog } from '@/utils/productionLogger';

export const useSaveAnswers = ({
  rankingId,
  concurso,
  answers,
  setIsSaving,
  setError,
  setSavedSuccess,
  onSuccess,
  discursiveScore,
  caseStudy1Score,
  caseStudy2Score,
  caseStudy3Score,
  subjectScores,
  editCount,
  nullifiedQuestions = new Set(),
  selectedBookletId
}: UseSaveAnswersProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isPro } = useSubscription();
  const navigate = useNavigate();

  const handleSaveAnswers = async () => {
    try {
      setIsSaving(true);
      setError(null);
      setSavedSuccess(false);

      // ✅ SEGURANÇA: Validação de formato apenas (limite de edições validado no backend)
      const validation = validateSaveAnswers(editCount, selectedBookletId);
      if (!validation.isValid) {
        setError(validation.errorMessage!);
        return;
      }

      // Debug logs removed for security
      // Debug logs removed for security
      // Debug logs removed for security
      
      // Debug dos valores subjetivos recebidos
      // Debug logs removed for security
      // Debug logs removed for security
      // Debug logs removed for security

      // Garantir que sempre temos um bookletId válido
      let bookletIdString = 'default';
      
      // Buscar dados do usuário atual
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('Usuário não autenticado');
        return;
      }

      // Buscar dados consolidados usando user_id
      const { data: currentRanking } = await supabase
        .from('user_rankings')
        .select('consolidated_data')
        .eq('user_id', user.id)
        .maybeSingle();

      // Extrair selected_booklet_id da estrutura consolidada
      const consolidatedData = currentRanking?.consolidated_data;
      const rankingData = consolidatedData?.rankings?.[rankingId];
      const bookletFromData = rankingData?.selected_booklet_id;
      
      if (bookletFromData) {
        bookletIdString = String(bookletFromData);
      } else if (selectedBookletId && selectedBookletId.trim() !== '') {
        bookletIdString = String(selectedBookletId);
      } else {
        // Se não temos bookletId, tentar buscar o primeiro caderno disponível
        try {
          const { data: concursoData } = await supabase
            .from('concursos')
            .select('exam_booklets')
            .eq('id', concurso.id)
            .maybeSingle();
          
          if (concursoData?.exam_booklets && concursoData.exam_booklets.length > 0) {
            bookletIdString = concursoData.exam_booklets[0].id;
            // Debug logs removed for security
          } else {
            // Debug logs removed for security
          }
        } catch (error) {
          devLog.error('[useSaveAnswers] Erro ao buscar cadernos:', error);
        }
      }

      // Preparar dados das respostas
      const preparedData = prepareAnswersData(answers, concurso, nullifiedQuestions, subjectScores, bookletIdString);

      // Debug logs removed for security
      // Debug logs removed for security

      // Salvar diretamente no consolidated_data sem usar RPC
      // Debug logs removed for security
        // Debug logs removed for security
      
      // Buscar dados atuais do usuário
      const { data: currentUserRanking, error: fetchError } = await supabase
        .from('user_rankings')
        .select('consolidated_data')
        .eq('user_id', user.id)
        .maybeSingle();

      if (fetchError) {
        devLog.error('[useSaveAnswers] Erro ao buscar dados do usuário:', fetchError);
        throw new Error('Erro ao buscar dados do usuário');
      }

      if (!currentUserRanking?.consolidated_data) {
        throw new Error('Dados de ranking do usuário não encontrados');
      }

      // Atualizar consolidated_data
      const updatedConsolidatedData = { ...currentUserRanking.consolidated_data };
      
      if (updatedConsolidatedData.rankings && updatedConsolidatedData.rankings[rankingId]) {
        // Atualizar ranking existente - SALVAR answers E pontuações subjetivas
        const updatedRankingData = {
          ...updatedConsolidatedData.rankings[rankingId],
          user_data: {
            ...updatedConsolidatedData.rankings[rankingId].user_data,
            answers: preparedData.answers,
            all_questions_answered: (() => {
              // Contar total de respostas na estrutura {bookletId: {disciplineType: {questionNumber: answer}}}
              let totalAnswers = 0;
              Object.values(preparedData.answers).forEach(bookletAnswers => {
                Object.values(bookletAnswers).forEach(disciplineAnswers => {
                  totalAnswers += Object.keys(disciplineAnswers).length;
                });
              });
              return totalAnswers > 0;
            })(),
            // SALVAR pontuações subjetivas (limpar subjetivas removidas)
            subjectives: (() => {
              // Buscar valores existentes para preservá-los se não forem alterados
              const existingSubjectives = updatedConsolidatedData.rankings[rankingId].user_data?.subjectives || {};
              
              // ✅ NOVA LÓGICA: Identificar quais subjetivas estão ativas no concurso atual
              const activeSubjectives = {
                discursive: concurso.subjects?.discr === true,
                case_study_1: concurso.subjects?.case1 === true,
                case_study_2: concurso.subjects?.case2 === true,
                case_study_3: concurso.subjects?.case3 === true,
                other_subjective: concurso.subjects?.other === true
              };
              
              // Debug logs removed for security
              
              // ✅ CORREÇÃO: Só preservar valores de subjetivas que ainda estão ativas
              const subjectiveValues = {
                discursive: activeSubjectives.discursive 
                  ? (subjectScores?.discursive ?? existingSubjectives.discursive ?? 0)
                  : 0,
                case_study_1: activeSubjectives.case_study_1 
                  ? (subjectScores?.case_study_1 ?? existingSubjectives.case_study_1 ?? 0)
                  : 0,
                case_study_2: activeSubjectives.case_study_2 
                  ? (subjectScores?.case_study_2 ?? existingSubjectives.case_study_2 ?? 0)
                  : 0,
                case_study_3: activeSubjectives.case_study_3 
                  ? (subjectScores?.case_study_3 ?? existingSubjectives.case_study_3 ?? 0)
                  : 0,
                other_subjective: activeSubjectives.other_subjective 
                  ? (subjectScores?.other_subjective ?? existingSubjectives.other_subjective ?? 0)
                  : 0
              };
              
              // Debug logs removed for security
              
              return subjectiveValues;
            })(),
            // Preservar reservation_type dentro de user_data
            reservation_type: updatedConsolidatedData.rankings[rankingId].user_data?.reservation_type || 'Ampla Concorrência',
            // Atualizar object_scores com a nova estrutura baseada em disciplinas
            object_scores: (() => {
              const existingObjectScores = updatedConsolidatedData.rankings[rankingId].user_data?.object_scores || {};
              // Debug logs removed for security
              
              // Migrar object_scores existente para nova estrutura se necessário
              const migratedObjectScores = migrateObjectScores(existingObjectScores, concurso);
              // Debug logs removed for security
              
              return migratedObjectScores;
            })()
            // score, subject_scores_tot serão atualizados pelo recalculateUserScore
          },
          selected_booklet_id: bookletIdString,
          edit_count: editCount + 1,
          control_metadata: {
            ...updatedConsolidatedData.rankings[rankingId].control_metadata,
            last_updated: new Date().toISOString()
          }
        };

        updatedConsolidatedData.rankings[rankingId] = updatedRankingData;
      } else {
        throw new Error('Ranking não encontrado nos dados consolidados');
      }

      // ✅ NOVO: Usar função RPC que atualiza E recalcula automaticamente
      const { data: updateResult, error: updateError } = await supabase.rpc('update_consolidated_data_and_recalculate', {
        p_user_id: user.id,
        p_ranking_id: rankingId,
        p_concurso_id: concurso.id,
        p_updated_data: updatedConsolidatedData
      });

      if (updateError) {
        devLog.error('[useSaveAnswers] Erro ao atualizar dados e recalcular:', updateError);
        throw new Error('Erro ao salvar respostas e recalcular pontuações');
      }

      // ✅ Se a função RPC não funcionou, tentar método manual como fallback
      if (!updateResult?.success) {
        // Fallback: fazer UPDATE direto e depois recalcular
        const { error: directUpdateError } = await supabase
          .from('user_rankings')
          .update({
            consolidated_data: updatedConsolidatedData
          })
          .eq('user_id', user.id);

        if (directUpdateError) {
          devLog.error('[useSaveAnswers] Erro ao atualizar dados (fallback):', directUpdateError);
          throw new Error('Erro ao salvar respostas');
        }

        // Recalcular usando função separada
        try {
          const recalculationResult = await recalculateUserScore(user.id, concurso.id);
          
          if (!recalculationResult.success) {
            devLog.error('[useSaveAnswers] ❌ Erro no recálculo de pontuações:', recalculationResult.message);
            throw new Error(`Falha no recálculo de pontuações: ${recalculationResult.message}`);
          }
        } catch (recalculationError: any) {
          devLog.error('[useSaveAnswers] ❌ Erro ao chamar recálculo de pontuações:', recalculationError);
          throw new Error(`Erro no recálculo de pontuações: ${recalculationError.message}`);
        }
      }
      
      // Debug logs removed for security

      // Debug logs removed for security
      // Debug logs removed for security

      // Limpar cache local para forçar busca de dados frescos
      // Debug logs removed for security
      rankingCache.clear();
      
      // Invalidar queries para refresh automático
      // Debug logs removed for security
      queryClient.invalidateQueries({ queryKey: ['rankings', concurso.id] });
      queryClient.invalidateQueries({ queryKey: ['rankings-v2', concurso.id] });
      queryClient.invalidateQueries({ queryKey: ['participant-count-v2', concurso.id] });
      queryClient.invalidateQueries({ queryKey: ['user-participation-v2', concurso.id] });
      queryClient.invalidateQueries({ queryKey: ['concurso', concurso.id] });
      queryClient.invalidateQueries({ queryKey: ['user-answers', rankingId] });
      queryClient.invalidateQueries({ queryKey: ['answer-stats', rankingId] });
      queryClient.invalidateQueries({ queryKey: ['user-ranking-detail', rankingId] });
      // Invalidar todas as queries de rankings para garantir atualização
      queryClient.invalidateQueries({ queryKey: ['rankings'] });
      // Debug logs removed for security

      setSavedSuccess(true);
      toast({
        title: "Respostas salvas com sucesso",
        description: `${Object.keys(preparedData.answers).length} respostas foram salvas para o caderno selecionado.`,
        duration: 5000
      });

      onSuccess();

      // Após salvar, buscar o selected_booklet atualizado do banco
      const { data: updatedRanking } = await supabase
        .from('user_rankings')
        .select('consolidated_data')
        .eq('user_id', user.id)
        .maybeSingle();

      const refreshedConsolidatedData = updatedRanking?.consolidated_data;
      const updatedRankingData = refreshedConsolidatedData?.rankings?.[rankingId];
      const updatedBooklet = updatedRankingData?.selected_booklet_id;

      if (updatedBooklet) {
        // devLog.log('[useSaveAnswers] Estado do caderno atualizado após salvamento:', updatedBooklet);
        // Nota: setSelectedBookletId será chamado pelo componente pai se necessário
      }

    } catch (error: any) {
      devLog.error('[useSaveAnswers] Erro ao salvar respostas:', error);
      setError(error.message || "Erro ao salvar respostas");
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  return { handleSaveAnswers };
};

export * from './types';
