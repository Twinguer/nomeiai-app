import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type CutoffProjection = {
  success: boolean;
  cutoff_score?: number | null;
  vagas?: number;
  classified_ampla_count?: number;
  gabarito_status?: string;
  is_provisional?: boolean;
  has_enough_candidates?: boolean;
  message?: string;
};

export function useCutoffProjection(concursoId?: string, enabled = true) {
  return useQuery({
    queryKey: ['cutoff-projection', concursoId],
    queryFn: async (): Promise<CutoffProjection> => {
      if (!concursoId) {
        return { success: false, message: 'Concurso não informado' };
      }

      const { data, error } = await supabase.rpc('get_cutoff_projection', {
        p_concurso_id: concursoId,
      });

      if (error) {
        throw error;
      }

      return (data as CutoffProjection) ?? { success: false };
    },
    enabled: !!concursoId && enabled,
    staleTime: 30_000,
  });
}
