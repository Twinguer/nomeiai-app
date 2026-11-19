import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useSecureUrls } from '@/services/urlObfuscation';
import { useEditUrls } from '@/hooks/useEditUrls';
import { Skeleton } from '@/components/ui/skeleton';
import { PencilLine, Trophy, Users, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useAuth } from '@/hooks/useAuth';
import { deleteRanking } from '@/integrations/supabase/rankings/concursoManager';
import { devLog, sanitizeForLog } from '@/utils/productionLogger';
interface CreatedRankingsTabProps {
  userId: string;
}
const CreatedRankingsTab: React.FC<CreatedRankingsTabProps> = ({
  userId
}) => {
  const {
    user
  } = useAuth();
  const navigate = useNavigate();
  const { generateSecureUrl } = useSecureUrls();
  const { generateEditUrl } = useEditUrls();
  const {
    toast
  } = useToast();
  const [showAllRankings, setShowAllRankings] = useState(false);
  const {
    data: rankings,
    isLoading,
    refetch
  } = useQuery({
    queryKey: ['user-created-rankings', userId],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from('concursos').select(`
          id, 
          titulo,
          orgao,
          banca,
          created_at,
          created_by_user_id,
          is_admin_created
        `).eq('created_by_user_id', userId).order('created_at', {
        ascending: false
      });
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId
  });
  const {
    data: participantCounts = {}
  } = useQuery({
    queryKey: ['participant-counts-v2', rankings],
    queryFn: async () => {
      if (!rankings || rankings.length === 0) return {};
      
      const counts = {};
      
      // Para cada ranking, contar participantes na estrutura consolidated_data
      await Promise.all(rankings.map(async ranking => {
        const { data: userRankings } = await supabase
          .from('user_rankings')
          .select('consolidated_data');
        
        let participantCount = 0;
        if (userRankings) {
          userRankings.forEach(userRanking => {
            const rankings = (userRanking.consolidated_data as any)?.rankings;
            if (rankings) {
              Object.values(rankings as Record<string, any>).forEach((rankingData: any) => {
                if (rankingData.concurso_id === ranking.id) {
                  participantCount++;
                }
              });
            }
          });
        }
        
        counts[ranking.id] = participantCount;
      }));
      
      return counts;
    },
    enabled: !!rankings && rankings.length > 0
  });
  const handleDeleteRanking = async (rankingId: string) => {
    try {
      if (!user) {
        toast({
          title: "Erro",
          description: "Você precisa estar logado para excluir um ranking",
          variant: "destructive"
        });
        return;
      }
      await deleteRanking(rankingId, user.id);
      toast({
        title: "Ranking excluído",
        description: "O ranking foi excluído com sucesso"
      });
      refetch();
    } catch (error: any) {
      toast({
        title: "Erro ao excluir",
        description: error.message || "Não foi possível excluir o ranking",
        variant: "destructive"
      });
    }
  };

  // Display only top 3 if not showing all
  const displayRankings = showAllRankings ? rankings : rankings?.slice(0, 3);
  const hasMoreRankings = rankings?.length > 3;
  if (isLoading) {
    return <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>;
  }
  if (!rankings || rankings.length === 0) {
    return <Card>
        <CardContent className="p-6 text-center">
          <p className="text-muted-foreground mb-4">
            Você ainda não criou nenhum ranking.
          </p>
          <Button onClick={() => navigate('/criar-ranking')}>
            Criar meu primeiro ranking
          </Button>
        </CardContent>
      </Card>;
  }
  return <div className="space-y-4">
      <h3 className="text-lg font-medium">Rankings Criados ({rankings.length})</h3>
      
      <div className="grid gap-2">
        {displayRankings?.map((ranking: any) => <Card key={ranking.id} className="overflow-hidden">
            <div className="bg-card/80 p-4 flex flex-col sm:flex-row justify-between gap-4 items-start sm:items-center border-b border-border">
              <div>
                <h4 className="font-bold text-card-foreground">{ranking.titulo}</h4>
                <p className="text-muted-foreground text-sm font-bold">
                  {ranking.orgao} • {ranking.banca}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <Users className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    {participantCounts[ranking.id] || 0} participante(s)
                  </span>
                </div>
              </div>
              
              <div className="flex items-center gap-2 self-end">
                <Button size="sm" variant="outline" className="flex items-center gap-1 border-0" onClick={async () => {
                  try {
                    const secureUrl = await generateSecureUrl(ranking.id, 'ranking');
                    navigate(secureUrl);
                  } catch (error) {
                    devLog.error('Erro ao gerar URL segura:', error);
                  }
                }}>
                  <Trophy className="h-4 w-4" />
                  <span>Ver Ranking</span>
                </Button>
                
                <Button size="sm" variant="outline" className="flex items-center gap-1 border-0" onClick={async () => {
                  try {
                    const editUrl = await generateEditUrl(ranking.id);
                    navigate(editUrl);
                  } catch (error) {
                    toast({
                      title: "Erro",
                      description: "Não foi possível gerar link de edição",
                      variant: "destructive"
                    });
                  }
                }}>
                  <PencilLine className="h-4 w-4" />
                  <span>Editar</span>
                </Button>
                
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="destructive" className="flex items-center gap-1">
                      <Trash2 className="h-4 w-4" />
                      <span>Excluir</span>
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Excluir Ranking</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta ação não pode ser desfeita. Isso excluirá permanentemente o ranking e removerá os dados do servidor.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDeleteRanking(ranking.id)}>
                        Excluir
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </Card>)}
        
        {hasMoreRankings && <Button variant="ghost" onClick={() => setShowAllRankings(!showAllRankings)} className="mt-2 text-primary hover:text-primary/80 hover:bg-primary/10">
            {showAllRankings ? <>
                <ChevronUp className="h-4 w-4 mr-2" />
                Mostrar menos
              </> : <>
                <ChevronDown className="h-4 w-4 mr-2" />
                Ver mais rankings ({rankings.length - 3})
              </>}
          </Button>}
      </div>
    </div>;
};
export default CreatedRankingsTab;