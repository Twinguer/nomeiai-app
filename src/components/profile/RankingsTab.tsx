import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { PencilLine, Trophy, ChevronDown, ChevronUp, UserX } from 'lucide-react';
import { UserRankingDisplay } from '@/types/concursos';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { formatScore } from '@/lib/utils';
import { devLog, sanitizeForLog } from '@/utils/productionLogger';
import { UrlObfuscationService } from '@/services/urlObfuscation';
import {
  canViewClassification,
  getProfileRankingStatus,
  openRankingFromProfile,
} from '@/modules/rankings';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
interface RankingsTabProps {
  userId: string;
  userRankings?: UserRankingDisplay[];
  isAuthenticated?: boolean;
}
const RankingsTab: React.FC<RankingsTabProps> = ({
  userId,
  userRankings,
  isAuthenticated = false
}) => {
  const {
    user
  } = useAuth();
  const navigate = useNavigate();
  const [showAllRankings, setShowAllRankings] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const {
    data: rankings,
    isLoading
  } = useQuery({
    queryKey: ['user-rankings', userId],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from('user_rankings').select(`
          user_id,
          consolidated_data
        `).eq('user_id', userId);
      if (error) throw error;

      // Processar dados da nova estrutura consolidated_data
      const rankingsWithPositions = [];
      
      if (data && data.length > 0) {
        const userRanking = data[0]; // Deve haver apenas um registro por usuário
        const rankings = (userRanking.consolidated_data as any)?.rankings;
        
        if (rankings) {
          // Iterar sobre todos os rankings do usuário
          for (const [rankingId, rankingData] of Object.entries(rankings as Record<string, any>)) {
            const concursoId = (rankingData as any).concurso_id;
            if (!concursoId) {
              devLog.error('No concurso ID found for ranking');
              continue;
            }

            try {
              // ✅ VERIFICAR SE O CONCURSO EXISTE ANTES DE PROCESSAR
              const { data: concursoCheck, error: concursoCheckError } = await supabase
                .from('concursos')
                .select('is_general_card')
                .eq('id', concursoId)
                .maybeSingle();
              
              // Se o concurso não existir, pular (ranking "fantasma")
              if (concursoCheckError || !concursoCheck) {
                devLog.warn(`Ranking "fantasma" encontrado: concurso_id ${concursoId} não existe mais. Pulando...`);
                continue;
              }
              
              // Se for card geral, pular (não mostrar)
              if (concursoCheck.is_general_card === true) {
                continue;
              }

              // Posição alinhada com a tabela de classificação (rankingService)
              const { position, isEliminated } = await getProfileRankingStatus(concursoId, userId);

              const { data: concursoData } = await supabase
                .from('concursos')
                .select('exam_type, titulo, orgao, banca')
                .eq('id', concursoId)
                .maybeSingle();

              // Mapear dados da nova estrutura para a estrutura esperada
              const mappedRanking = {
                id: rankingId,
                score: (rankingData as any).user_data?.score || 0,
                object_scores: (rankingData as any).user_data?.object_scores || {},
                weighted_discursive_score: (rankingData as any).user_data?.subjectives?.discursive_score || 0,
                weighted_case_study_1_score: (rankingData as any).user_data?.subjectives?.case_study_1_score || 0,
                weighted_case_study_2_score: (rankingData as any).user_data?.subjectives?.case_study_2_score || 0,
                weighted_case_study_3_score: (rankingData as any).user_data?.subjectives?.case_study_3_score || 0,
                created_at: (rankingData as any).control_metadata?.created_at,
                reservation_type: (rankingData as any).user_data?.reservation_type || 'Ampla Concorrência',
                concurso_id: concursoId,
                concursos: concursoData,
                position,
                isEliminated
              };

              rankingsWithPositions.push(mappedRanking);
            } catch (error) {
              devLog.error('Erro ao calcular posição:', error);
              // ✅ TAMBÉM VERIFICAR SE É CARD GERAL NO CATCH
              const { data: concursoCheck } = await supabase
                .from('concursos')
                .select('is_general_card')
                .eq('id', concursoId)
                .maybeSingle();
              
              // Se for card geral, não adicionar
              if (concursoCheck?.is_general_card === true) {
                continue;
              }

              // Adicionar ranking com dados básicos mesmo em caso de erro
              const { data: concursoData } = await supabase
                .from('concursos')
                .select('exam_type, titulo, orgao, banca')
                .eq('id', concursoId)
                .maybeSingle();

              rankingsWithPositions.push({
                id: rankingId,
                score: (rankingData as any).user_data?.score || 0,
                object_scores: (rankingData as any).user_data?.object_scores || {},
                weighted_discursive_score: (rankingData as any).user_data?.subjectives?.discursive_score || 0,
                weighted_case_study_1_score: (rankingData as any).user_data?.subjectives?.case_study_1_score || 0,
                weighted_case_study_2_score: (rankingData as any).user_data?.subjectives?.case_study_2_score || 0,
                weighted_case_study_3_score: (rankingData as any).user_data?.subjectives?.case_study_3_score || 0,
                created_at: (rankingData as any).control_metadata?.created_at,
                reservation_type: (rankingData as any).user_data?.reservation_type || 'Ampla Concorrência',
                concurso_id: concursoId,
                concursos: concursoData,
                position: null,
                isEliminated: false
              });
            }
          }
        }
      }
      return rankingsWithPositions || [];
    },
    enabled: !userRankings && !!userId // Only fetch if userRankings is not provided and userId exists
  });

  // Calcula posições também quando userRankings é passado via props (Meu Perfil > Rankings)
  const { data: propRankingsWithPositions } = useQuery({
    queryKey: ['user-rankings-positions', userId, userRankings],
    queryFn: async () => {
      const list = await Promise.all((userRankings || []).map(async (ranking: any) => {
        const concursoId = ranking.concurso_id || ranking.concursoId;
        if (!concursoId) {
          return { ...ranking, position: null, isEliminated: false };
        }
        
        try {
          // ✅ VERIFICAR SE É CARD GERAL
          const { data: concursoCheck } = await supabase
            .from('concursos')
            .select('is_general_card')
            .eq('id', concursoId)
            .maybeSingle();
          
          // Se for card geral, retornar null para filtrar depois
          if (concursoCheck?.is_general_card === true) {
            return null;
          }
          
          // Posição alinhada com a tabela de classificação (rankingService)
          const { position, isEliminated } = await getProfileRankingStatus(concursoId, userId);
          return { ...ranking, position, isEliminated };
        } catch (e) {
          devLog.error('Erro ao calcular posição (props):', e);
          // ✅ TAMBÉM VERIFICAR NO CATCH
          const { data: concursoCheck } = await supabase
            .from('concursos')
            .select('is_general_card')
            .eq('id', concursoId)
            .maybeSingle();
          
          if (concursoCheck?.is_general_card === true) {
            return null;
          }
          
          return { ...ranking, position: null, isEliminated: false };
        }
      }));
      
      // ✅ FILTRAR NULLS (cards gerais removidos)
      return list.filter((r: any) => r !== null);
    },
    enabled: !!userRankings && !!userId,
  });

  // Lista final considerada: se veio via props, usa a versão enriquecida; caso contrário, os dados buscados
  const allRankings = userRankings ? (propRankingsWithPositions || userRankings) : rankings;
  const showSkeleton = isLoading && !userRankings;

  // ✅ Rankings devem vir já ordenados do backend
  // Manter ordem original, apenas aplicar filtro se necessário
  const sortedRankings = allRankings || [];

  // Display only top 2 if not showing all
  const displayRankings = showAllRankings ? sortedRankings : sortedRankings?.slice(0, 2);
  const hasMoreRankings = sortedRankings?.length > 2;

  // Verifica se o usuário atual é o dono do perfil
  const isOwnProfile = user?.id === userId;

  // Mutation para deixar de participar do ranking
  const leaveRankingMutation = useMutation({
    mutationFn: async (ranking: any) => {
      // Log removido por segurança - não expor dados completos do ranking
      
      try {
        // ✅ SEMPRE usar concurso_id (nunca usar ranking.id que é a chave do objeto)
        const concursoId = ranking.concurso_id || ranking.concursos?.id;
        const currentUserId = user?.id; // O usuário atual que está saindo
        
        if (!concursoId || !currentUserId) {
          throw new Error('Informações insuficientes - concursoId: ' + concursoId + ', userId: ' + currentUserId);
        }

        // Log removido por segurança

        // Primeiro buscar o ID do user_ranking
        const { data: userRanking, error: findError } = await supabase
          .from('user_rankings')
          .select('user_id, consolidated_data')
          .eq('user_id', currentUserId)
          .maybeSingle();

        if (findError || !userRanking) {
          devLog.error('Erro ao buscar ranking do usuário:', findError);
          throw new Error('Ranking do usuário não encontrado');
        }

        // ✅ Encontrar o rankingId (chave do objeto) que corresponde ao concursoId
        const rankings = userRanking.consolidated_data?.rankings || {};
        let rankingIdToRemove: string | null = null;
        
        for (const [key, value] of Object.entries(rankings)) {
          if ((value as any).concurso_id === concursoId) {
            rankingIdToRemove = key;
            break;
          }
        }

        if (!rankingIdToRemove) {
          throw new Error('Usuário não está participando deste concurso');
        }

        // Log removido por segurança

        // 1. Buscar dados do usuário
        const { data: userRankingData, error: fetchError } = await supabase
          .from('user_rankings')
          .select('consolidated_data')
          .eq('user_id', currentUserId)
          .maybeSingle();
        
        if (fetchError) {
          devLog.error('Erro ao buscar dados do usuário:', fetchError);
          throw fetchError;
        }

        // 2. Remover ranking específico do JSON consolidado usando o rankingId correto
        const rankingsData = (userRankingData?.consolidated_data as any)?.rankings;
        if (rankingsData) {
          const updatedData = { ...(userRankingData.consolidated_data as any) };
          const { [rankingIdToRemove]: removed, ...remainingRankings } = rankingsData as Record<string, any>;
          updatedData.rankings = remainingRankings;
          
          // Atualizar dados consolidados
          const { error: updateError } = await supabase
            .from('user_rankings')
            .update({ consolidated_data: updatedData })
            .eq('user_id', currentUserId);
          
          if (updateError) {
            devLog.error('Erro ao atualizar dados consolidados:', updateError);
            throw updateError;
          }
        }

        // 3. Deletar das tabelas relacionadas
        // Log removido por segurança
        
        // Deletar score_calculation_logs usando user_id (formato correto)
        const { error: logsError } = await supabase
          .from('score_calculation_logs')
          .delete()
          .eq('user_ranking_id', currentUserId);
        
        if (logsError) {
          devLog.error('Erro ao deletar score_calculation_logs:', logsError);
        }

        // user_answers não é mais usado - dados estão em user_rankings consolidated_data
        // A remoção dos dados consolidados é feita automaticamente via CASCADE

        // Deletar user_ranking
        const { error: rankingError } = await supabase
          .from('user_rankings')
          .delete()
          .eq('user_id', currentUserId);
        
        if (rankingError) {
          devLog.error('Erro ao deletar user_ranking:', rankingError);
          throw rankingError;
        }

        // Log removido por segurança
        return { success: true };
      } catch (error) {
        devLog.error('Erro ao sair do ranking:', error);
        throw error;
      }
    },
    onSuccess: () => {
      toast({
        title: "Sucesso",
        description: "Você deixou de participar do ranking.",
      });
      queryClient.invalidateQueries({ queryKey: ['user-rankings', userId] });
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: "Erro ao deixar de participar do ranking. Tente novamente.",
        variant: "destructive",
      });
      devLog.error('Erro ao deixar de participar:', error);
    }
  });
  if (showSkeleton) {
    return <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>;
  }
  if (!allRankings || allRankings.length === 0) {
    return <Card>
        <CardContent className="p-6 text-center">
          <p className="text-muted-foreground mb-4">
            Este usuário ainda não está participando de nenhum ranking.
          </p>
          <Button variant="outline" onClick={() => navigate('/pre-classificacao')}>
            Ver Rankings disponíveis
          </Button>
        </CardContent>
      </Card>;
  }
  return <div className="space-y-4">
      <h3 className="text-lg font-medium">Rankings ({allRankings.length})</h3>
      
      <div className="grid gap-2">
        {displayRankings.map((ranking: any) => 
          <Card key={ranking.concurso_id || ranking.concursos?.id || ranking.id} className="overflow-hidden">
            <div className="bg-card/80 p-4 flex justify-between items-center border-b border-border">
              <div className="flex-1">
                <h4 className="font-semibold text-card-foreground text-base mb-1">
                  {ranking.concursos?.titulo || ranking.concursoTitle}
                </h4>
                <p className="text-sm text-muted-foreground flex items-center">
                  🏆 Participando - {formatScore(ranking.score)} pts
                </p>
              </div>
              
              <div className="flex flex-col items-end text-right">
                <div className="text-2xl font-bold text-card-foreground mb-1">
                  {formatScore(ranking.score)} <span className="text-sm font-normal text-muted-foreground">pts</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  <span className="text-muted-foreground mr-1">Classificação:</span>
                  {ranking.isEliminated ? (
                    <span className="text-destructive font-bold">E</span>
                  ) : ranking.position ? (
                    <span className="font-medium">{ranking.position}º</span>
                  ) : (
                    <span className="text-muted-foreground/50">—</span>
                  )}
                </div>
              </div>
            </div>
            
            <div className="p-4 bg-card flex justify-end gap-2">
              <Button size="sm" variant="outline" className="flex items-center gap-1" onClick={() => {
                const concursoId = ranking.concurso_id || ranking.concursos?.id;
                if (!concursoId) {
                  devLog.error('ConcursoId não encontrado:', ranking);
                  toast({
                    title: "Erro",
                    description: "ID do concurso não encontrado. Tente novamente.",
                    variant: "destructive"
                  });
                  return;
                }
                openRankingFromProfile(navigate, concursoId);
              }}>
                <Trophy className="h-4 w-4" />
                <span>Ranking</span>
              </Button>
              
              {isOwnProfile && (
                <>
                  <Button size="sm" className="flex items-center gap-1 bg-primary hover:bg-primary/90" onClick={async () => {
                    // ✅ SEMPRE usar concurso_id (nunca usar ranking.id que é a chave do objeto)
                    const concursoId = ranking.concurso_id || ranking.concursos?.id;
                    if (!concursoId || concursoId === 'undefined') {
                      devLog.error('ConcursoId não encontrado:', ranking);
                      toast({
                        title: "Erro",
                        description: "ID do concurso não encontrado. Tente novamente.",
                        variant: "destructive"
                      });
                      return;
                    }
                    try {
                      // ✅ Gerar token seguro e navegar para rota segura
                      const token = await UrlObfuscationService.generateConcursoToken(concursoId);
                      navigate(`/concurso/participar/${token}?showAnswerSheet=true`);
                    } catch (error) {
                      devLog.error('Erro ao gerar token seguro:', error);
                      toast({
                        title: "Erro",
                        description: "Não foi possível gerar link seguro. Tente novamente.",
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
                        <UserX className="h-4 w-4" />
                        <span>Deixar</span>
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Deixar de participar?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Tem certeza que deseja deixar de participar deste ranking? Esta ação não pode ser desfeita e você perderá todas as suas respostas.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction 
                          onClick={() => leaveRankingMutation.mutate(ranking)}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          Confirmar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              )}
            </div>
          </Card>
        )}
        
        {hasMoreRankings && <Button variant="ghost" onClick={() => setShowAllRankings(!showAllRankings)} className="mt-2 text-primary hover:text-primary/80 hover:bg-primary/10">
            {showAllRankings ? <>
                <ChevronUp className="h-4 w-4 mr-2" />
                Mostrar menos
              </> : <>
                <ChevronDown className="h-4 w-4 mr-2" />
                Ver mais rankings ({sortedRankings.length - 2})
              </>}
          </Button>}
      </div>
    </div>;
};

export default RankingsTab;