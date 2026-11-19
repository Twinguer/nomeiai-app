
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { RankingItemProps } from '@/components/rankings/RankingList';
import { devLog, sanitizeForLog } from '@/utils/productionLogger';

const fetchRankings = async (): Promise<RankingItemProps[]> => {
  try {
    const { data: concursos, error } = await supabase
      .from('concursos')
      .select(`
        id,
        titulo,
        orgao,
        banca,
        created_at,
        status,
        created_by_user_id,
        is_admin_created,
        localidades,
        is_general_card,
        parent_concurso_id,
        total_participants,
        watermark_image_url
      `)
      .eq('is_general_card', true)
      .order('created_at', { ascending: false });

    if (error) {
      // Se as colunas não existirem, buscar apenas rankings antigos (sem hierarquia)
      if (error.message?.includes('is_general_card') || 
          error.message?.includes('parent_concurso_id') || 
          error.message?.includes('does not exist')) {
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('concursos')
          .select(`
            id,
            titulo,
            orgao,
            banca,
            created_at,
            status,
            created_by_user_id,
            is_admin_created,
            localidades
          `)
          .order('created_at', { ascending: false });
        
        if (fallbackError) throw fallbackError;
        
        // Retornar dados com campos padrão para hierarquia
        const rankings = await Promise.all(
          (fallbackData || []).map(async (concurso) => {
            const { data: countData } = await supabase
              .rpc('count_concurso_participants', { concurso_id: concurso.id });
            
            return {
              id: concurso.id,
              examDate: concurso.created_at || new Date().toISOString(),
              banca: concurso.banca,
              concursoTitle: concurso.orgao,
              cargoTitle: concurso.titulo,
              participantCount: countData || 0,
              createdByUserId: concurso.created_by_user_id || null,
              creatorName: null,
              isAdminCreated: concurso.is_admin_created,
              localidade: null,
              isGeneralCard: false,
              watermarkImageUrl: null
            };
          })
        );
        
        return rankings;
      }
      throw error;
    }

    // For each concurso, get the participant count and creator info
    const rankings = await Promise.all(
      concursos.map(async (concurso) => {
        // Para card geral, usar total_participants (calculado pela trigger)
        // Para card de cargo, usar RPC function
        let participantCount = 0;
        let watermarkUrl = concurso.watermark_image_url;
        
        if (concurso.is_general_card) {
          // Para card geral, usar função RPC que garante cálculo correto
          const { data: generalCount, error: generalError } = await supabase
            .rpc('get_general_card_participant_count', { p_general_card_id: concurso.id });
          
          if (generalError) {
            devLog.error('Error fetching general card participant count:', generalError);
            // Fallback para total_participants do banco
            participantCount = concurso.total_participants || 0;
          } else {
            participantCount = generalCount || 0;
          }
        } else {
          const { data: countData, error: countError } = await supabase
            .rpc('count_concurso_participants', { concurso_id: concurso.id });

          if (countError) {
            devLog.error('Error fetching participant count:', countError);
            return null;
          }
          participantCount = countData || 0;
          
          // Herdar marca d'água do parent se não tiver própria
          if (!watermarkUrl && concurso.parent_concurso_id) {
            const { data: parentData } = await supabase
              .from('concursos')
              .select('watermark_image_url')
              .eq('id', concurso.parent_concurso_id)
              .single();
            
            if (parentData?.watermark_image_url) {
              watermarkUrl = parentData.watermark_image_url;
            }
          }
        }

        // If there's a creator user ID, fetch their name (using public view)
        let creatorName = null;
        if (concurso.created_by_user_id && !concurso.is_admin_created) {
          const { data: userData, error: userError } = await supabase
            .from('users_profiles')
            .select('name')
            .eq('id', concurso.created_by_user_id)
            .maybeSingle();

          if (!userError && userData) {
            creatorName = userData.name;
          }
        }

        // Filtrar apenas cards gerais (não mostrar cards de cargo aqui)
        if (!concurso.is_general_card) {
          return null;
        }

        // Processar todas as localidades selecionadas
        let localidade = null;
        if (concurso.localidades && Array.isArray(concurso.localidades) && concurso.localidades.length > 0) {
          if (concurso.localidades.includes('Nacional')) {
            localidade = 'Nacional';
          } else if (concurso.localidades.length > 3) {
            localidade = `${concurso.localidades.slice(0, 3).join(', ')} e outras`;
          } else {
            localidade = concurso.localidades.join(', ');
          }
        }

        return {
          id: concurso.id,
          examDate: concurso.created_at || new Date().toISOString(),
          banca: concurso.banca,
          concursoTitle: concurso.orgao,
          cargoTitle: null, // Cards gerais não têm cargo
          participantCount: participantCount,
          createdByUserId: concurso.created_by_user_id || null,
          creatorName: creatorName,
          isAdminCreated: concurso.is_admin_created,
          localidade: localidade,
          isGeneralCard: true,
          watermarkImageUrl: watermarkUrl
        };
      })
    );

    return rankings.filter(Boolean) as RankingItemProps[];
  } catch (error) {
    devLog.error('Error fetching rankings:', error);
    return [];
  }
};

export function useRankingsData() {
  const { data: rankings = [], isLoading } = useQuery({
    queryKey: ['rankings'],
    queryFn: fetchRankings,
    // Reduzir staleTime para atualizar mais rapidamente (30 segundos)
    staleTime: 30 * 1000,
    gcTime: 2 * 60 * 1000,
    // Disabling retry to avoid too many calls in case of error
    retry: 1,
    // Refetch quando a janela recebe foco para garantir dados atualizados
    refetchOnWindowFocus: true
  });

  return {
    rankings,
    isLoading
  };
}