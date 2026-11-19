
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchConcursoById } from '@/services/concursoService';
import { LoadingState } from '@/modules/rankings/components/classification/LoadingState';
import { ParticipationForm } from '@/modules/rankings/components/participation/ParticipationForm';
import { isParticipatingInConcurso } from '@/modules/rankings/domain/rankingAccess';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';
import { devLog, sanitizeForLog } from '@/utils/productionLogger';

interface ConcursoParticipationProps {
  concursoId?: string;
  secureToken?: string;
}

const ConcursoParticipationPage: React.FC<ConcursoParticipationProps> = ({
  concursoId, 
  secureToken 
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // ✅ Usar concursoId passado como prop pelo SecureConcursoRoute
  const id = concursoId;

  devLog.log('[ConcursoParticipation] Concurso ID from props:', id);

  // Fetch concurso details with better error handling
  const {
    data: concurso,
    isLoading: isLoadingConcurso,
    error: concursoError
  } = useQuery({
    queryKey: ['concurso', id],
    queryFn: async () => {
      if (!id) {
        throw new Error('ID do concurso não fornecido');
      }
      
      devLog.log('[ConcursoParticipation] Fetching concurso with ID:', id);
      const result = await fetchConcursoById(id);
      devLog.log('[ConcursoParticipation] Concurso fetched:', result);
      return result;
    },
    enabled: !!id,
    retry: 1
  });

  // Check if user is already participating and get ranking ID
  const {
    data: userRanking,
    isLoading: isCheckingParticipation
  } = useQuery({
    queryKey: ['participating', id, user?.id],
    queryFn: async () => {
      if (!user || !id) return null;
      
      const { data, error } = await supabase
        .from('user_rankings')
        .select('consolidated_data')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (error) {
        devLog.error('[ConcursoParticipation] Error checking participation:', error);
        throw error;
      }
      
      if (!data?.consolidated_data?.rankings) return null;

      if (!isParticipatingInConcurso(data.consolidated_data, id)) {
        return null;
      }

      for (const key in data.consolidated_data.rankings) {
        const ranking = data.consolidated_data.rankings[key];
        if (ranking.concurso_id === id) {
          return {
            id: key, // rankingId
            reservation_type: ranking.reservation_type,
            ...ranking
          };
        }
      }
      
      return null;
    },
    enabled: !!user && !!id
  });

  if (isLoadingConcurso || isCheckingParticipation) {
    return <LoadingState />;
  }

  // Handle errors
  if (concursoError) {
    devLog.error('[ConcursoParticipation] Error loading concurso:', concursoError);
    
    return (
      <Card className="mx-auto max-w-4xl mt-6">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle className="h-6 w-6 text-destructive" />
            <h1 className="text-2xl font-bold text-destructive">Erro ao carregar concurso</h1>
          </div>
          <div className="space-y-2">
            <p className="text-foreground">
              Não foi possível encontrar o concurso solicitado.
            </p>
            <p className="text-sm text-muted-foreground">
              ID: {id}
            </p>
            <p className="text-sm text-muted-foreground">
              Erro: {concursoError.message}
            </p>
          </div>
          <button 
            onClick={() => navigate('/concursos')}
            className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
          >
            Voltar para Concursos
          </button>
        </CardContent>
      </Card>
    );
  }

  if (!id) {
    return (
      <Card className="mx-auto max-w-4xl mt-6">
        <CardContent className="p-6">
          <h1 className="text-2xl font-bold mb-4 text-foreground">ID do concurso não fornecido</h1>
          <p className="text-muted-foreground">Por favor, acesse um concurso válido.</p>
        </CardContent>
      </Card>
    );
  }

  if (!concurso) {
    return (
      <Card className="mx-auto max-w-4xl mt-6">
        <CardContent className="p-6">
          <h1 className="text-2xl font-bold mb-4 text-foreground">Concurso não encontrado</h1>
          <p className="text-muted-foreground">O concurso que você está tentando acessar não existe ou foi removido.</p>
          <p className="text-sm text-muted-foreground mt-2">ID: {id}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="mt-4">
        <ParticipationForm 
          concurso={concurso} 
          isAlreadyParticipating={!!userRanking} 
          userRankingId={userRanking?.id} 
        />
      </div>
    </div>
  );
};

export default ConcursoParticipationPage;
