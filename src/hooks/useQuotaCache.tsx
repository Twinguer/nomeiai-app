import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface QuotaConfig {
  ppp: boolean;
  pcd: boolean;
  ind: boolean;
  hip: boolean;
  tra: boolean;
  min_cota: number;
}

const fetchQuotaConfig = async (concursoId: string): Promise<QuotaConfig> => {
  const { data, error } = await supabase
    .from('concursos')
    .select('has_cota')
    .eq('id', concursoId)
    .single();
    
  if (error) {
    return {
      ppp: false,
      pcd: false,
      ind: false,
      hip: false,
      tra: false,
      min_cota: 0,
    };
  }
  
  return data?.has_cota || {
    ppp: false,
    pcd: false,
    ind: false,
    hip: false,
    tra: false,
    min_cota: 0,
  };
};

export const useQuotaCache = (concursoId: string) => {
  return useQuery({
    queryKey: ['quota-config', concursoId],
    queryFn: () => fetchQuotaConfig(concursoId),
    staleTime: 10 * 60 * 1000, // 10 minutos - cotas raramente mudam
    gcTime: 30 * 60 * 1000, // 30 minutos
    enabled: !!concursoId,
  });
};
