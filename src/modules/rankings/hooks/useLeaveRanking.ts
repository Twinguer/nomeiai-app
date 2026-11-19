import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { rankingCache } from '@/modules/rankings/services/rankingCache';
import { devLog, sanitizeForLog } from '@/utils/productionLogger';

export const useLeaveRanking = () => {
  const queryClient = useQueryClient();

  const { mutate: leave, isPending: isLeaving } = useMutation({
    mutationFn: async (concursoId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      // Verificar se o usuário está participando do ranking
      const { data: userRankingData, error: rankingError } = await supabase
        .from('user_rankings')
        .select('consolidated_data')
        .eq('user_id', user.id)
        .single();

      if (rankingError) throw rankingError;
      if (!userRankingData?.consolidated_data?.rankings) {
        throw new Error('Você não está participando deste ranking');
      }

      // Encontrar a chave do ranking que corresponde ao concursoId
      const rankings = userRankingData.consolidated_data.rankings;
      const rankingKey = Object.keys(rankings).find(key => 
        rankings[key].concurso_id === concursoId
      );

      if (!rankingKey) {
        throw new Error('Você não está participando deste ranking');
      }

      // Remover ranking do JSON consolidado do usuário
      const updatedData = { ...userRankingData.consolidated_data };
      delete updatedData.rankings[rankingKey];

      const { error: updateError } = await supabase
        .from('user_rankings')
        .update({ consolidated_data: updatedData })
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      // Deletar registros relacionados usando o user_id (formato correto para score_calculation_logs)
      await supabase.from('score_calculation_logs').delete().eq('user_ranking_id', user.id);
      // user_answers não é mais usado - dados estão em user_rankings consolidated_data
      
      // Não precisamos deletar da tabela user_rankings pois ela contém dados consolidados
      // A remoção do ranking específico já foi feita no consolidated_data

      return { success: true };
    },
    onSuccess: (data, concursoId) => {
      // devLog.log('[useLeaveRanking] 🎉 Usuário saiu do ranking com sucesso, invalidando queries...');
      toast.success('Você saiu do ranking com sucesso');
      
      // Limpar cache local para forçar busca de dados frescos
      // devLog.log('[useLeaveRanking] 🗑️ Limpando cache local...');
      rankingCache.clear();
      
      // Invalidar todas as queries relacionadas ao concurso para refresh automático
      queryClient.invalidateQueries({ queryKey: ['rankings', concursoId] });
      queryClient.invalidateQueries({ queryKey: ['participant-count-v2', concursoId] });
      queryClient.invalidateQueries({ queryKey: ['user-participation-v2', concursoId] });
      queryClient.invalidateQueries({ queryKey: ['concurso', concursoId] });
      
      // Invalidar queries gerais também
      queryClient.invalidateQueries({ queryKey: ['rankings'] });
      queryClient.invalidateQueries({ queryKey: ['participant-count'] });
      queryClient.invalidateQueries({ queryKey: ['user-participation'] });
      
      // devLog.log('[useLeaveRanking] ✅ Cache limpo e queries invalidadas, dados serão atualizados automaticamente');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao sair do ranking: ${error.message}`);
    },
  });

  return { leave, isLeaving };
};
