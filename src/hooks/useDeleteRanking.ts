
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { devLog, sanitizeForLog } from '@/utils/productionLogger';

export const useDeleteRanking = () => {
  const queryClient = useQueryClient();

  const deleteRankingMutation = useMutation({
    mutationFn: async (concursoId: string) => {
      // devLog.log('Iniciando exclusão do ranking:', concursoId);
      
      try {
        // ✅ Verificar se é card geral e buscar cards filhos
        const { data: rankingCheck, error: checkError } = await supabase
          .from('concursos')
          .select('is_general_card')
          .eq('id', concursoId)
          .maybeSingle();
        
        if (checkError) {
          devLog.error('Erro ao verificar tipo do ranking:', checkError);
        }
        
        // ✅ Se for card geral, buscar todos os cards filhos
        let allConcursoIds = [concursoId]; // Incluir o card geral também
        
        if (rankingCheck?.is_general_card === true) {
          const { data: childCards, error: childError } = await supabase
            .from('concursos')
            .select('id')
            .eq('parent_concurso_id', concursoId);
          
          if (childError) {
            devLog.error('Erro ao buscar cards filhos:', childError);
          } else if (childCards && childCards.length > 0) {
            // Adicionar IDs dos cards filhos à lista
            allConcursoIds = [concursoId, ...childCards.map(c => c.id)];
          }
        }
        
        // 1. Primeiro buscar os IDs dos user_rankings para deletar dependências
        // devLog.log('Buscando user_rankings para deletar dependências...');
        const { data: userRankings, error: fetchError } = await supabase
          .from('user_rankings')
          .select('user_id, consolidated_data')
          .not('consolidated_data', 'is', null);
        
        if (fetchError) {
          devLog.error('Erro ao buscar user_rankings:', fetchError);
          throw fetchError;
        }
        
        // ✅ Filter user_rankings that have any of these concursos in their consolidated_data
        const relevantUserRankings = userRankings?.filter(ur => {
          if (!ur.consolidated_data?.rankings) return false;
          // Verificar se participa de qualquer um dos concursos (geral ou filhos)
          return allConcursoIds.some(id => 
            ur.consolidated_data?.rankings?.[id]
          );
        }) || [];

        if (relevantUserRankings && relevantUserRankings.length > 0) {
          const userIds = relevantUserRankings.map(ur => ur.user_id);
          
          // 2. Deletar score_calculation_logs primeiro - CORREÇÃO CRUCIAL
          devLog.log('Deletando score_calculation_logs...');
          const { error: logsError } = await supabase
            .from('score_calculation_logs')
            .delete()
            .in('user_ranking_id', userIds);
          
          if (logsError) {
            devLog.error('Erro ao deletar score_calculation_logs:', logsError);
            throw logsError;
          }

          // 3. user_answers não é mais usado - dados estão em user_rankings consolidated_data
          // A remoção dos dados consolidados é feita automaticamente via CASCADE
          // Debug logs removed for security
          
          // 4. ✅ Remove ALL concursos (geral + filhos) from consolidated_data for each user
          for (const userId of userIds) {
            const { data: userRankingData, error: fetchUserError } = await supabase
              .from('user_rankings')
              .select('consolidated_data')
              .eq('user_id', userId)
              .maybeSingle();
              
            if (!fetchUserError && userRankingData?.consolidated_data) {
              const updatedData = { ...userRankingData.consolidated_data };
              let hasChanges = false;
              
              // Remover todos os concursos (geral + filhos) do consolidated_data
              if (updatedData.rankings) {
                for (const id of allConcursoIds) {
                  if (updatedData.rankings[id]) {
                    delete updatedData.rankings[id];
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
        }

        // 5. official_answer_weights agora são gerenciados via JSONB na tabela concursos
        devLog.log('official_answer_weights são gerenciados via JSONB na tabela concursos - não precisa deletar');

        // 6. Cadernos são gerenciados via JSONB na tabela concursos
        devLog.log('Cadernos são gerenciados via JSONB na tabela concursos - não precisa deletar');

        // 7. Finalmente deletar o concurso (o CASCADE vai deletar os filhos automaticamente se for card geral)
        devLog.log('Deletando concurso...');
        const { error: concursoError } = await supabase
          .from('concursos')
          .delete()
          .eq('id', concursoId);
        
        if (concursoError) {
          devLog.error('Erro ao deletar concurso:', concursoError);
          throw concursoError;
        }

        // devLog.log('Ranking deletado com sucesso:', concursoId);
        return { success: true };
      } catch (error) {
        devLog.error('Erro na exclusão do ranking:', error);
        throw error;
      }
    },
    onSuccess: () => {
      toast.success('Ranking deletado com sucesso');
      queryClient.invalidateQueries({ queryKey: ['rankings'] });
      queryClient.invalidateQueries({ queryKey: ['concursos'] });
      queryClient.invalidateQueries({ queryKey: ['admin-concursos'] });
      queryClient.invalidateQueries({ queryKey: ['user-created-rankings'] });
    },
    onError: (error: any) => {
      devLog.error('Erro ao deletar ranking:', error);
      toast.error(`Erro ao deletar ranking: ${error.message || 'Erro desconhecido'}`);
    }
  });

  return {
    deleteRanking: deleteRankingMutation.mutate,
    isDeleting: deleteRankingMutation.isPending
  };
};