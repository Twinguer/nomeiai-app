
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Concurso } from '@/types/concursos';
import { devLog, sanitizeForLog } from '@/utils/productionLogger';

interface CreatorInfoResult {
  creatorName: string | null;
  isAdmin: boolean;
  isLoading: boolean;
  error: Error | null;
}

export function useRankingCreatorInfo(concurso: Concurso): CreatorInfoResult {
  const fetchCreatorInfo = async () => {
    // If the concurso is marked as admin-created, return default values
    if (concurso.is_admin_created) {
      return { name: 'Admin', isAdmin: true };
    }
    
    // If there's no creator ID, return unknown
    if (!concurso.created_by_user_id) {
      return { name: 'Desconhecido', isAdmin: false };
    }
    
    // Fetch the user profile (using public view)
    const { data, error } = await supabase
      .from('public_profiles')
      .select('name')
      .eq('id', concurso.created_by_user_id)
      .single();
      
    if (error) {
      devLog.error('Error fetching creator info:', error);
      throw error;
    }
    
    return { 
      name: data?.name || 'Usuário', 
      isAdmin: false 
    };
  };
  
  const { 
    data, 
    isLoading, 
    error 
  } = useQuery({
    queryKey: ['creator-info', concurso.id, concurso.created_by_user_id],
    queryFn: fetchCreatorInfo,
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 15 * 60 * 1000,    // 15 minutes
    enabled: !!concurso.id
  });
  
  return {
    creatorName: data?.name || null,
    isAdmin: data?.isAdmin || false,
    isLoading,
    error: error as Error | null
  };
}
