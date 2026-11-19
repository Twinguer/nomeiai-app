import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { UserPlus, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Concurso, isDisciplineBlock } from '@/types/concursos';
import { UserActions } from '@/components/Admin/UserActions';
import { getDisciplines, sectionDisplayNames, updateSectionDisplayNames } from '@/integrations/supabase/rankings/examStructure';
// ✅ CONSOLIDADO: Usar interface única do rankingService
import type { Ranking } from '@/modules/rankings/services/rankingService';
import { UserUrlObfuscationService } from '@/services/userUrlObfuscation';
import { LoadMoreButton } from './LoadMoreButton';
import { formatScore } from '@/lib/utils';
import { devLog, sanitizeForLog } from '@/utils/productionLogger';
import { getReservationAbbreviation, normalizeReservationType } from '@/utils/quotaNormalization';
import { getAvatarUrl } from '@/utils/avatarUtils';
import { useAdminAuth } from '@/hooks/useAdminAuth';

interface RankingTableProps {
  rankings?: Ranking[];
  concurso?: Concurso;
  currentUserId?: string | null;
  isAuthenticated: boolean;
  isRefetching?: boolean;
  // Props de paginação
  hasMore?: boolean;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
  totalLoaded?: number;
}

export const RankingTable: React.FC<RankingTableProps> = ({
  rankings,
  concurso,
  currentUserId,
  isAuthenticated,
  isRefetching = false,
  hasMore = false,
  onLoadMore,
  isLoadingMore = false,
  totalLoaded = 0
}) => {
  // Component render tracking removed for security
  
  const navigate = useNavigate();

  // Debug: verificar se os rankings estão sendo recebidos
  // useEffect(() => {
  //   devLog.log('RankingTable received rankings:', {
  //     rankingsLength: rankings?.length || 0,
  //     rankings: rankings?.slice(0, 3), // Primeiros 3 para debug
  //     hasMore,
  //     totalLoaded,
  //     isAuthenticated,
  //     currentUserId
  //   });
  // }, [rankings, hasMore, totalLoaded, isAuthenticated, currentUserId]);

  // Debug: verificar se o componente está sendo renderizado
  // devLog.log('RankingTable render:', {
  //   rankingsLength: rankings?.length || 0,
  //   isLoadingMore,
  //   hasMore,
  //   totalLoaded
  // });
  // const { generateSecureUserUrl } = useSecureUserUrls();
  const [activeTab, setActiveTab] = useState("ac");
  const [displayNames, setDisplayNames] = useState<Record<string, string>>(sectionDisplayNames);

  useEffect(() => {
    // Update section display names with custom disciplines when concurso is available
    if (concurso) {
      const updatedNames = updateSectionDisplayNames(concurso);
      setDisplayNames(updatedNames);
    }
  }, [concurso]);

  // Helper function to determine if a ranking is below the required minimum
  // ✅ CORREÇÃO CRÍTICA: Verificar mínimo global ATUAL do concurso, não apenas flag salvo
  const isBelowMinimum = (ranking: Ranking): boolean => {
    const score = ranking.score || 0;
    const reservationType = ranking.reservationType || 'Ampla Concorrência';
    
    // ✅ CORREÇÃO CRÍTICA: Extrair e verificar mínimo global ATUAL do concurso
    let minimumTotalScore = 0;
    let minimumTotalScoreCotas = 0;
    
    if (concurso?.disciplines && typeof concurso.disciplines === 'object' && !Array.isArray(concurso.disciplines)) {
      minimumTotalScore = Number(concurso.disciplines.minimum_total_score) || 0;
      minimumTotalScoreCotas = Number(concurso.disciplines.minimum_total_score_cotas) || 0;
    }
    
    // ✅ CORREÇÃO CRÍTICA: Verificar mínimo global ATUAL (não apenas flag salvo)
    const isCotas = reservationType !== 'Ampla Concorrência';
    const applicableMinimum = isCotas ? minimumTotalScoreCotas : minimumTotalScore;
    const belowGlobalMinimum = applicableMinimum > 0 && score < applicableMinimum;
    
    // Verificação de mínimos por disciplina/bloco (do flag salvo)
    const hasDisciplineMinimums = ranking.belowDisciplineMinimums && 
      ranking.belowDisciplineMinimums.length > 0;
    const hasBlockMinimums = ranking.belowBlockMinimums && 
      ranking.belowBlockMinimums.length > 0;
    
    // NOVA LÓGICA: Para provas "Certo ou Errado", eliminar se nota <= 0
    const isCertoErradoEliminated = concurso?.exam_type === 'Certo ou Errado' && 
      score <= 0;
    
    // NOVA LÓGICA: Para provas "Alternativas", eliminar se nota <= 0
    const isAlternativasEliminated = concurso?.exam_type === 'Alternativas' && 
      score <= 0;
    
    // ✅ CORREÇÃO: Usar flag salvo OU verificar mínimo global atual
    return !!ranking.belowMinimum || 
           belowGlobalMinimum || // ✅ NOVO: Verificar mínimo global atual
           hasDisciplineMinimums || 
           hasBlockMinimums || 
           isCertoErradoEliminated || 
           isAlternativasEliminated;
  };

  // Calculate quota positions for each ranking, separating classified from eliminated
  const rankingsWithQuotaPositions = React.useMemo(() => {
    if (!rankings) return [];

    // ✅ PRESERVAR a ordem original dos rankings (já vem ordenada do backend)
    // Não reordenar, pois isso quebra a correspondência entre position e a ordem real
    
    // Separate classified from eliminated users (mantendo ordem original)
    const classifiedRankings: Ranking[] = [];
    const eliminatedRankings: Ranking[] = [];
    
    rankings.forEach(ranking => {
      if (isBelowMinimum(ranking)) {
        eliminatedRankings.push(ranking);
      } else {
        classifiedRankings.push(ranking);
      }
    });

    // ✅ CORREÇÃO: Group classified rankings by reservation type (mantendo ordem original dentro de cada grupo)
    // Normalizar reservationType para garantir consistência
    const groupedByQuota: Record<string, Ranking[]> = {};
    classifiedRankings.forEach(ranking => {
      // Normalizar reservationType: garantir que seja string válida
      const normalizedQuota = (ranking.reservationType || 'Ampla Concorrência').trim();
      
      if (!groupedByQuota[normalizedQuota]) {
        groupedByQuota[normalizedQuota] = [];
      }
      groupedByQuota[normalizedQuota].push(ranking);
    });

    // ✅ Ordenar cada grupo de cota por score (descending) APENAS para calcular quotaPosition
    // Mas manter a ordem original dos rankings classificados para preservar position
    Object.keys(groupedByQuota).forEach(quotaType => {
      groupedByQuota[quotaType].sort((a, b) => b.score - a.score);
    });

    // ✅ CORREÇÃO: Calculate positions for classified users (mantendo ordem original)
    const classifiedWithPositions = classifiedRankings.map((ranking) => {
      // Normalizar reservationType para garantir consistência na busca
      const normalizedQuota = (ranking.reservationType || 'Ampla Concorrência').trim();
      const sameQuotaRankings = groupedByQuota[normalizedQuota] || [];
      const quotaPosition = sameQuotaRankings.findIndex(r => r.id === ranking.id) + 1;
      
      return {
        ...ranking,
        // ✅ PRESERVAR a posição original na ampla concorrência que veio do backend
        // Esta posição foi calculada considerando TODOS os rankings, não apenas os da cota
        position: ranking.position || 0,
        quotaPosition: quotaPosition > 0 ? quotaPosition : 0
      };
    });

    // Eliminated users don't get positions, they're marked as eliminated
    const eliminatedWithoutPositions = eliminatedRankings.map(ranking => ({
      ...ranking,
      position: ranking.position || 0, // ✅ PRESERVAR posição original mesmo para eliminados
      quotaPosition: 0
    }));

    // Return classified users first, then eliminated users (mantendo ordem original dentro de cada grupo)
    return [...classifiedWithPositions, ...eliminatedWithoutPositions];
  }, [rankings]);

  const getAvailableQuotas = React.useMemo(() => {
    if (!concurso) {
      return ["ac"];
    }
    
    const quotas = ["ac"];
    if (concurso.has_cota?.ppp === true) {
      quotas.push("ppp");
    }
    if (concurso.has_cota?.pcd === true) {
      quotas.push("pcd");
    }
    if (concurso.has_cota?.hip === true) {
      quotas.push("hip");
    }
    if (concurso.has_cota?.ind === true) {
      quotas.push("ind");
    }
    if (concurso.has_cota?.tra === true) {
      quotas.push("tran");
    }
    
    return quotas;
  }, [concurso]);

  const availableQuotas = getAvailableQuotas;

  const filterRankingsByQuota = (quota: string) => {
    if (!rankingsWithQuotaPositions) return [];
    
    // Mapeamento entre abreviações e nomes completos
    const quotaMapping: Record<string, string> = {
      "ac": "Ampla Concorrência",
      "ppp": "PPP", 
      "pcd": "PCD",
      "hip": "Hipossuficientes",
      "ind": "Indígenas",
      "tran": "Pessoas Trans"
    };
    
    if (quota === "ac") {
      return rankingsWithQuotaPositions;
    }
    
    // ✅ CORREÇÃO: Filtrar por cota com normalização para garantir consistência
    const fullQuotaName = quotaMapping[quota];
    return rankingsWithQuotaPositions.filter(ranking => {
      const normalizedRankingQuota = normalizeReservationType(ranking.reservationType);
      return normalizedRankingQuota === fullQuotaName;
    });
  };

  const handleUserClick = async (userId: string) => {
    if (!userId || userId === 'undefined') {
      return;
    }
    
    if (!isAuthenticated) {
      navigate('/auth', { state: { from: window.location.pathname } });
      return;
    }
    
    try {
      const secureUrl = await UserUrlObfuscationService.generateSecureProfileUrl(userId);
      navigate(secureUrl);
    } catch (error: any) {
      devLog.error('Erro ao gerar URL segura:', error);
      // ✅ SEGURANÇA: Nunca usar fallback com UUID direto
      // Em produção, mostrar erro
      if (import.meta.env.PROD) {
        toast({
          title: 'Erro de configuração',
          description: 'O sistema não está configurado corretamente. Entre em contato com o suporte.',
          variant: 'destructive'
        });
        return;
      }
      // Em desenvolvimento, redirecionar para comunidade (não expor UUID)
      navigate('/comunidade');
    }
  };

  return <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Classificação Pós-prova</CardTitle>
        {isRefetching && <div className="flex items-center text-xs text-amber-600 gap-1">
            <RefreshCw className="h-3 w-3 animate-spin" />
            <span>Atualizando dados...</span>
          </div>}
        {!isAuthenticated && <div className="text-sm text-muted-foreground mt-1">
            <Link to="/auth" className="text-primary hover:underline">
              Faça login
            </Link> para participar deste ranking ou para acessar perfis completos.
          </div>}
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="ac" value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="mb-4 flex flex-wrap h-auto">
              {availableQuotas.map(quota => (
                <TabsTrigger key={quota} value={quota} className="text-sm">
                  {quota}
                </TabsTrigger>
              ))}
            </TabsList>
            
            {availableQuotas.map(quota => <TabsContent key={quota} value={quota}>
                <RankingTableContent 
                  rankings={filterRankingsByQuota(quota)} 
                  currentUserId={currentUserId} 
                  handleUserClick={handleUserClick} 
                  concurso={concurso} 
                  isAmpla={quota === "ac"} 
                  availableQuotas={availableQuotas} 
                  isAuthenticated={isAuthenticated} 
                  isRefetching={isRefetching} 
                  activeTab={quota}
                  displayNames={displayNames} // Pass display names
                  hasMore={hasMore}
                  onLoadMore={onLoadMore}
                  isLoadingMore={isLoadingMore}
                  totalLoaded={totalLoaded}
                />
              </TabsContent>)}
          </Tabs>
      </CardContent>
    </Card>;
};

const RankingTableContent: React.FC<{
  rankings: Ranking[];
  currentUserId?: string | null;
  handleUserClick: (userId: string) => void;
  concurso?: Concurso;
  isAmpla: boolean;
  availableQuotas: string[];
  isAuthenticated: boolean;
  isRefetching?: boolean;
  activeTab: string;
  displayNames: Record<string, string>; // Added display names prop
  // Props de paginação
  hasMore?: boolean;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
  totalLoaded?: number;
}> = ({
  rankings,
  currentUserId,
  handleUserClick,
  concurso,
  isAmpla,
  availableQuotas,
  isAuthenticated,
  isRefetching = false,
  activeTab,
  displayNames, // Accept display names
  // Props de paginação
  hasMore = false,
  onLoadMore,
  isLoadingMore = false,
  totalLoaded = 0
}) => {
  const { isAdmin: isAdminMode } = useAdminAuth();

  // State to store scores when table is loaded
  const [initialScores, setInitialScores] = useState<{
    [key: string]: number;
  }>({});

  // Initialize initial scores on first render
  useEffect(() => {
    const scores: {
      [key: string]: number;
    } = {};
    rankings.forEach(ranking => {
      scores[ranking.id] = ranking.score;
    });
    setInitialScores(scores);
  }, [rankings]);

  // Function to check if a score has been updated
  const hasScoreChanged = (rankingId: string, currentScore: number): boolean => {
    return initialScores[rankingId] !== undefined && initialScores[rankingId] !== currentScore && !isRefetching;
  };

  // Function to determine if a ranking is below the required minimum
  // A verificação de mínimos é feita no backend (Edge Function e função do banco)
  // O frontend confia no flag belowMinimum que vem do backend
  const isBelowMinimum = (ranking: Ranking): boolean => {
    const score = ranking.score || 0;
    
    // 1. Verificar flag belowMinimum (mínimo global) - calculado no backend usando score objetivo
    const belowMinimum = !!ranking.belowMinimum;
    
    // 2. Verificar mínimos por disciplina/bloco (flags salvos)
    const hasDisciplineMinimums = ranking.belowDisciplineMinimums && 
      ranking.belowDisciplineMinimums.length > 0;
    const hasBlockMinimums = ranking.belowBlockMinimums && 
      ranking.belowBlockMinimums.length > 0;
    
    // 3. Para provas "Certo ou Errado" ou "Alternativas", eliminar se nota <= 0
    // NOTA: Para essas provas, o score já é o objetivo (não há subjetivas)
    const isCertoErradoEliminated = concurso?.exam_type === 'Certo ou Errado' && score <= 0;
    const isAlternativasEliminated = concurso?.exam_type === 'Alternativas' && score <= 0;
    
    return belowMinimum || 
           hasDisciplineMinimums || 
           hasBlockMinimums || 
           isCertoErradoEliminated || 
           isAlternativasEliminated;
  };

  // Recalculate quota positions for the filtered rankings (only within the current quota tab)
  const rankingsWithRecalculatedQuotaPositions = React.useMemo(() => {
    if (!rankings || rankings.length === 0) return rankings || [];
    
    // ✅ PRESERVAR a ordem e posições originais dos rankings
    // Não recalcular position baseado no índice, pois isso quebra a posição na ampla concorrência
    
    // Separate classified from eliminated (mantendo ordem original)
    const classified = rankings.filter(r => !isBelowMinimum(r));
    const eliminated = rankings.filter(r => isBelowMinimum(r));
    
    // ✅ CORREÇÃO: Group classified by quota type (mantendo ordem original dentro de cada grupo)
    // Normalizar reservationType para garantir consistência
    const groupedByQuota: Record<string, Ranking[]> = {};
    classified.forEach(ranking => {
      // Normalizar reservationType: garantir que seja string válida
      const normalizedQuota = (ranking.reservationType || 'Ampla Concorrência').trim();
      
      if (!groupedByQuota[normalizedQuota]) {
        groupedByQuota[normalizedQuota] = [];
      }
      groupedByQuota[normalizedQuota].push(ranking);
    });
    
    // Sort each quota group by score (descending) APENAS para calcular quotaPosition
    Object.keys(groupedByQuota).forEach(quotaType => {
      groupedByQuota[quotaType].sort((a, b) => b.score - a.score);
    });
    
    // ✅ CORREÇÃO: Calculate quota positions (mantendo ordem original dos classificados)
    const withPositions = classified.map((ranking) => {
      // Normalizar reservationType para garantir consistência na busca
      const normalizedQuota = (ranking.reservationType || 'Ampla Concorrência').trim();
      const sameQuotaRankings = groupedByQuota[normalizedQuota] || [];
      const quotaPosition = sameQuotaRankings.findIndex(r => r.id === ranking.id) + 1;
      
      return {
        ...ranking,
        // ✅ PRESERVAR a posição original na ampla concorrência que veio do backend
        // Esta posição foi calculada considerando TODOS os rankings, não apenas os filtrados
        position: ranking.position || 0,
        quotaPosition: quotaPosition > 0 ? quotaPosition : 0
      };
    });
    
    // Eliminated users don't get positions
    const eliminatedWithoutPositions = eliminated.map(ranking => ({
      ...ranking,
      position: ranking.position || 0, // ✅ PRESERVAR posição original mesmo para eliminados
      quotaPosition: 0
    }));
    
    return [...withPositions, ...eliminatedWithoutPositions];
  }, [rankings, isBelowMinimum]);
  
  // Function to calculate the objective total score of the ranking
  const calculateObjectiveScore = (ranking: Ranking): number => {
    // If there are custom disciplines
    if (ranking.weightedCustomDisciplineScores && Object.keys(ranking.weightedCustomDisciplineScores).length > 0) {
      return Object.values(ranking.weightedCustomDisciplineScores).reduce((sum, score) => sum + Number(score || 0), 0);
    }
    
    // Otherwise, use traditional scores
    return 0; // Implement if necessary
  };

  // Get enabled custom disciplines from either JSONB object with blocks or legacy arrays
  const getCustomDisciplines = (): { type: string; name: string }[] => {
    if (!concurso || !concurso.disciplines) {
      return [];
    }

    const allEnabledDisciplines: { type: string; name: string }[] = [];

    // New JSONB structure: object with blocks
    if (typeof concurso.disciplines === 'object' && !Array.isArray(concurso.disciplines) && (concurso.disciplines as any).blocks) {
      const blocks = (concurso.disciplines as any).blocks || [];
      for (const block of blocks) {
        if (block?.disciplines && Array.isArray(block.disciplines)) {
          for (const discipline of block.disciplines) {
            if (
              discipline &&
              typeof discipline === 'object' &&
              discipline.isEnabled === true &&
              typeof discipline.type === 'string' &&
              typeof discipline.name === 'string'
            ) {
              allEnabledDisciplines.push({ type: discipline.type, name: discipline.name });
            }
          }
        }
      }
      return allEnabledDisciplines;
    }

    // Legacy array structure (hierarchical blocks or flat)
    if (Array.isArray(concurso.disciplines)) {
      const isHierarchical = concurso.disciplines.length > 0 && isDisciplineBlock(concurso.disciplines[0]);
      if (isHierarchical) {
        for (const block of concurso.disciplines) {
          if (isDisciplineBlock(block)) {
            for (const discipline of block.disciplines) {
              if (
                discipline &&
                typeof discipline === 'object' &&
                discipline.isEnabled === true &&
                typeof discipline.type === 'string' &&
                typeof discipline.name === 'string'
              ) {
                allEnabledDisciplines.push({ type: discipline.type, name: discipline.name });
              }
            }
          }
        }
      } else {
        for (const discipline of concurso.disciplines) {
          if (
            discipline &&
            typeof discipline === 'object' &&
            'isEnabled' in discipline &&
            (discipline as any).isEnabled === true &&
            'type' in discipline &&
            'name' in discipline
          ) {
            allEnabledDisciplines.push({
              type: (discipline as any).type as string,
              name: (discipline as any).name as string,
            });
          }
        }
      }
      return allEnabledDisciplines;
    }

    return [];
  };

  const customDisciplines = getCustomDisciplines();
  
  if (!concurso) {
    // Debug logs removed for security
    // ... keep existing code for the simplified table
    return <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-center w-16">AC</TableHead>
            {isAmpla && <TableHead className="text-center w-16">AP</TableHead>}
            <TableHead className="min-w-[200px]">Candidato</TableHead>
            <TableHead className="text-right">Total</TableHead>
            {isAdminMode && isAuthenticated && <TableHead className="w-24">Ações</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rankings.length > 0 ? rankings.map(ranking => <TableRow key={ranking.userId} className={currentUserId && ranking.userId === currentUserId ? 'bg-muted' : ''}>
              <TableCell className="text-center font-bold">{ranking.position}º</TableCell>
              {isAmpla && <TableCell className="text-center font-bold">
                {ranking.reservationType === "Ampla Concorrência" ? ranking.position + "º" : ""}
              </TableCell>}
              <TableCell>
                <div className="flex items-center gap-2 cursor-pointer hover:text-emerald-600 transition-colors" onClick={() => handleUserClick(ranking.userId)}>
                  <Avatar className="h-8 w-8 flex-shrink-0">
                    <AvatarImage src={getAvatarUrl(ranking.avatarUrl)} alt={ranking.name} />
                    <AvatarFallback>{ranking.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <span className="whitespace-nowrap">{ranking.name}</span>
                  {isAmpla && ranking.reservationType !== "Ampla Concorrência" && <span className="ml-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full flex-shrink-0">
                      {getReservationAbbreviation(ranking.reservationType)}
                    </span>}
                </div>
              </TableCell>
              <TableCell className="text-right font-medium">{formatScore(ranking.score)}</TableCell>
              {isAdminMode && isAuthenticated && <TableCell>
                  <UserActions userId={ranking.userId} userName={ranking.name} concursoId={concurso?.id} onSuccess={() => window.location.reload()} showOnlyRankingActions={true} />
                </TableCell>}
            </TableRow>) : <TableRow>
              <TableCell colSpan={isAdminMode && isAuthenticated ? isAmpla ? 5 : 4 : isAmpla ? 4 : 3} className="text-center py-4">
                Nenhum participante registrado nesta lista ainda
              </TableCell>
            </TableRow>}
        </TableBody>
      </Table>;
  }

  // Determine table columns based on concurso disciplines
  const renderTableHeader = () => <TableHeader>
      <TableRow>
        <TableHead className="text-center w-16">ac</TableHead>
        {!isAmpla && <TableHead className="text-center w-16">
          {getReservationAbbreviation(activeTab)}
        </TableHead>}
        <TableHead className="min-w-[200px]">part</TableHead>
        <TableHead className="text-right">tot</TableHead>
        
        {/* Custom discipline columns */}
        {customDisciplines.map((discipline, idx) => <TableHead key={`custom-${idx}`} className="text-right">
            {discipline.name.toLowerCase()}
          </TableHead>)}
        
        {/* Subjective parts */}
        {(() => {
          // Debug logs removed for security
          return null;
        })()}
        
        {concurso.subjects?.discr === true && <TableHead className="text-right">dis</TableHead>}
        
        {concurso.subjects?.case1 === true && <TableHead className="text-right">ec1</TableHead>}
        
        {concurso.subjects?.case2 === true && <TableHead className="text-right">ec2</TableHead>}
        
        {concurso.subjects?.case3 === true && <TableHead className="text-right">ec3</TableHead>}
        
        {(() => {
          // Verificar se tem seção "Outro" usando sistema híbrido
          const hasOtherDirect = concurso.subjects?.other === true;
          let hasOtherJsonb = false;
          
          // Verificar nova estrutura hierárquica (objeto com blocks)
          if (concurso.disciplines && typeof concurso.disciplines === 'object' && !Array.isArray(concurso.disciplines) && concurso.disciplines.blocks) {
            for (const block of concurso.disciplines.blocks) {
              if (block.disciplines && Array.isArray(block.disciplines)) {
                for (const discipline of block.disciplines) {
                  if (discipline.isEnabled && discipline.type === 'other_subjective') {
                    hasOtherJsonb = true;
                    break;
                  }
                }
              }
              if (hasOtherJsonb) break;
            }
          }
          // Verificar estrutura antiga (array de blocos)
          else if (concurso.disciplines && Array.isArray(concurso.disciplines)) {
            for (const discipline of concurso.disciplines) {
              if ('disciplines' in discipline) {
                // Estrutura hierárquica antiga
                if (discipline.disciplines?.some(d => d.isEnabled && d.type === 'other_subjective')) {
                  hasOtherJsonb = true;
                  break;
                }
              } else {
                // Estrutura plana antiga
                if (discipline.isEnabled && discipline.type === 'other_subjective') {
                  hasOtherJsonb = true;
                  break;
                }
              }
            }
          }
          
          const hasOther = hasOtherDirect || hasOtherJsonb;
          
          return hasOther ? (
            <TableHead className="text-right">
              {(concurso.subjects?.name_other || 'Outro').toLowerCase()}
            </TableHead>
          ) : null;
        })()}
          
        {isAdminMode && isAuthenticated && <TableHead className="w-24">Ações</TableHead>}
      </TableRow>
    </TableHeader>;

  // Render each ranking row
  const renderRankingRows = () => {
    // Debug logs removed for security
    
    return <TableBody className="space-y-0.5">
      {rankingsWithRecalculatedQuotaPositions.length > 0 ? rankingsWithRecalculatedQuotaPositions.map(ranking => {
      const scoreChanged = hasScoreChanged(ranking.id, ranking.score);
      const belowMinimum = isBelowMinimum(ranking);
      
      // Apply class to highlight participants below minimum in red
      const rowColorClass = belowMinimum 
        ? 'text-red-600' 
        : (currentUserId && ranking.userId === currentUserId 
            ? 'bg-muted' 
            : scoreChanged 
              ? 'bg-green-50' 
              : '');
      
      return <TableRow key={ranking.userId} className={rowColorClass}>
            <TableCell className="text-center font-bold">
              {belowMinimum 
                ? <span className="text-red-600 font-bold">E</span> 
                : ranking.position > 0 
                  ? `${ranking.position}º`
                  : '-'
              }
            </TableCell>
            
            {!isAmpla && <TableCell className="text-center font-bold">
              {belowMinimum 
                ? <span className="text-red-600 font-bold">E</span>
                : (() => {
                    // Debug específico para PPP e PCD
                    if (ranking.reservationType === 'PPP' || ranking.reservationType === 'PCD') {
                      // Debug logs removed for security
                    }
                    
                    // Exibir posição da cota se existir e for maior que 0
                    if (ranking.quotaPosition && ranking.quotaPosition > 0) {
                      return `${ranking.quotaPosition}º`;
                    }
                    
                    // Se não tem posição da cota, mostrar '-'
                    return '-';
                  })()
              }
            </TableCell>}
            
            <TableCell>
              <div className="flex items-center gap-2 cursor-pointer hover:text-emerald-600 transition-colors" onClick={() => {
                // Debug logs removed for security
                handleUserClick(ranking.userId);
              }}>
                <Avatar className="h-8 w-8 flex-shrink-0">
                  <AvatarImage src={getAvatarUrl(ranking.avatarUrl)} alt={ranking.name} />
                  <AvatarFallback>{ranking.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <span className="whitespace-nowrap">
                  {ranking.name}
                  {isAmpla && ranking.reservationType !== "Ampla Concorrência" && <span className="ml-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full">
                      ({getReservationAbbreviation(ranking.reservationType)})
                    </span>}
                </span>
              </div>
            </TableCell>
            
            <TableCell className={`text-right font-medium ${scoreChanged && !belowMinimum ? 'text-emerald-600' : ''}`}>
              {formatScore(ranking.score)}
              {belowMinimum && <span className="ml-2 text-xs text-red-600"></span>}
            </TableCell>
            
            {/* Custom discipline scores */}
            {customDisciplines.map((discipline, idx) => {
              // Access the score using the discipline type as the key
              const scoreValue = ranking.weightedCustomDisciplineScores?.[discipline.type] || 0;
              // Check if this specific discipline is below minimum
              const isDisciplineBelowMinimum = ranking.belowDisciplineMinimums?.includes?.(discipline.type) || false;
              
              return <TableCell key={`custom-score-${idx}`} className={`text-right ${isDisciplineBelowMinimum ? 'text-red-600 font-bold' : ''}`}>
                      {formatScore(Number(scoreValue))}
                    </TableCell>;
            })}
            
            {/* Subjective part scores */}
            {concurso.subjects?.discr === true && <TableCell className={`text-right ${ranking.belowDisciplineMinimums?.includes('discursive') ? 'text-red-600 font-bold' : ''}`}>
                {(() => {
                  // Debug logs removed for security
                  return formatScore(Number(ranking.weightedDiscursiveScore || 0));
                })()}
              </TableCell>}
            
            {concurso.subjects?.case1 === true && <TableCell className={`text-right ${ranking.belowDisciplineMinimums?.includes('case_study_1') ? 'text-red-600 font-bold' : ''}`}>
                {formatScore(Number(ranking.weightedCaseStudy1Score || 0))}
              </TableCell>}
            
            {concurso.subjects?.case2 === true && <TableCell className={`text-right ${ranking.belowDisciplineMinimums?.includes('case_study_2') ? 'text-red-600 font-bold' : ''}`}>
                {formatScore(Number(ranking.weightedCaseStudy2Score || 0))}
              </TableCell>}
            
            {concurso.subjects?.case3 === true && <TableCell className={`text-right ${ranking.belowDisciplineMinimums?.includes('case_study_3') ? 'text-red-600 font-bold' : ''}`}>
                {formatScore(Number(ranking.weightedCaseStudy3Score || 0))}
              </TableCell>}
            
            {(() => {
              // Verificar se tem seção "Outro" usando sistema híbrido
              const hasOtherDirect = concurso.subjects?.other === true;
              let hasOtherJsonb = false;
              
              // Verificar nova estrutura hierárquica (objeto com blocks)
              if (concurso.disciplines && typeof concurso.disciplines === 'object' && !Array.isArray(concurso.disciplines) && concurso.disciplines.blocks) {
                for (const block of concurso.disciplines.blocks) {
                  if (block.disciplines && Array.isArray(block.disciplines)) {
                    for (const discipline of block.disciplines) {
                      if (discipline.isEnabled && discipline.type === 'other_subjective') {
                        hasOtherJsonb = true;
                        break;
                      }
                    }
                  }
                  if (hasOtherJsonb) break;
                }
              }
              // Verificar estrutura antiga (array de blocos)
              else if (concurso.disciplines && Array.isArray(concurso.disciplines)) {
                for (const discipline of concurso.disciplines) {
                  if ('disciplines' in discipline) {
                    // Estrutura hierárquica antiga
                    if (discipline.disciplines?.some(d => d.isEnabled && d.type === 'other_subjective')) {
                      hasOtherJsonb = true;
                      break;
                    }
                  } else {
                    // Estrutura plana antiga
                    if (discipline.isEnabled && discipline.type === 'other_subjective') {
                      hasOtherJsonb = true;
                      break;
                    }
                  }
                }
              }
              
              const hasOther = hasOtherDirect || hasOtherJsonb;
              
              return hasOther ? (
                <TableCell className={`text-right ${ranking.belowDisciplineMinimums?.includes('other_subjective') ? 'text-red-600 font-bold' : ''}`}>
                  {formatScore(Number(ranking.weightedOtherSubjectiveScore || 0))}
                </TableCell>
              ) : null;
            })()}
            
            {isAdminMode && isAuthenticated && <TableCell>
                <UserActions userId={ranking.userId} userName={ranking.name} concursoId={concurso?.id} onSuccess={() => window.location.reload()} showOnlyRankingActions={true} />
              </TableCell>}
          </TableRow>;
    }) : <TableRow>
          <TableCell colSpan={(() => {
            // Calcular colSpan usando sistema híbrido
            const hasOtherDirect = concurso.subjects?.other === true;
            let hasOtherJsonb = false;
            
            // Verificar nova estrutura hierárquica (objeto com blocks)
            if (concurso.disciplines && typeof concurso.disciplines === 'object' && !Array.isArray(concurso.disciplines) && concurso.disciplines.blocks) {
              for (const block of concurso.disciplines.blocks) {
                if (block.disciplines && Array.isArray(block.disciplines)) {
                  for (const discipline of block.disciplines) {
                    if (discipline.isEnabled && discipline.type === 'other_subjective') {
                      hasOtherJsonb = true;
                      break;
                    }
                  }
                }
                if (hasOtherJsonb) break;
              }
            }
            // Verificar estrutura antiga (array de blocos)
            else if (concurso.disciplines && Array.isArray(concurso.disciplines)) {
              for (const discipline of concurso.disciplines) {
                if ('disciplines' in discipline) {
                  // Estrutura hierárquica antiga
                  if (discipline.disciplines?.some(d => d.isEnabled && d.type === 'other_subjective')) {
                    hasOtherJsonb = true;
                    break;
                  }
                } else {
                  // Estrutura plana antiga
                  if (discipline.isEnabled && discipline.type === 'other_subjective') {
                    hasOtherJsonb = true;
                    break;
                  }
                }
              }
            }
            
            const hasOther = hasOtherDirect || hasOtherJsonb;
            
            return 4 + customDisciplines.length + 
                   (concurso.subjects?.discr ? 1 : 0) + 
                   (concurso.subjects?.case1 ? 1 : 0) + 
                   (concurso.subjects?.case2 ? 1 : 0) + 
                   (concurso.subjects?.case3 ? 1 : 0) + 
                   (hasOther ? 1 : 0) + 
                   (isAdminMode && isAuthenticated ? 1 : 0);
          })()} className="text-center py-4">
            Nenhum participante registrado nesta lista ainda
          </TableCell>
        </TableRow>}
    </TableBody>;
  };
    
  return (
    <div>
      <Table className="min-w-max">
        {renderTableHeader()}
        {renderRankingRows()}
      </Table>
      
      {/* Botão Carregar Mais */}
      {onLoadMore && (
        <LoadMoreButton
          onLoadMore={onLoadMore}
          isLoading={isLoadingMore}
          hasMore={hasMore}
          totalLoaded={totalLoaded}
          className="mt-4"
        />
      )}
    </div>
  );
};
