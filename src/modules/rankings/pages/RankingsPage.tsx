import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trophy, Users, TrendingUp, Search, Filter, Calendar, Plus, Medal, Star, Target } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription, usePlanLimits } from '@/modules/payments';
import { devLog, sanitizeForLog } from '@/utils/productionLogger';
import { openRankingFromList } from '@/modules/rankings';
interface Concurso {
  id: string;
  titulo: string;
  orgao: string;
  banca: string;
  vagas: number;
  inscritos: number;
  created_at: string;
  status: string;
  participant_count?: number;
  watermark_image_url?: string;
}
const RankingsPage = () => {
  const {
    user
  } = useAuth();
  const { isPro, isLoading: isSubscriptionLoading } = useSubscription();
  const { currentRankingCount } = usePlanLimits();
  const navigate = useNavigate();
  const [concursos, setConcursos] = useState<Concurso[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('participants');

  const handleRankingClick = async (e: React.MouseEvent, concursoId: string) => {
    e.preventDefault();
    if (user && isSubscriptionLoading) {
      return;
    }
    await openRankingFromList({ user, isPro, navigate }, concursoId);
  };
  useEffect(() => {
    loadConcursos();
  }, []);
  const loadConcursos = async () => {
    try {
      // Tentar buscar apenas cards gerais (com fallback para rankings antigos)
      const {
        data,
        error
      } = await supabase.from('concursos').select(`
          id,
          titulo,
          orgao,
          banca,
          vagas,
          inscritos,
          created_at,
          status,
          watermark_image_url,
          is_general_card,
          parent_concurso_id
        `)
        .eq('is_general_card', true)
        .order('created_at', {
          ascending: false
        });
      
      if (error) {
        // Se a coluna não existir, buscar todos (fallback para rankings antigos)
        if (error.message?.includes('is_general_card') || 
            error.message?.includes('does not exist')) {
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('concursos')
            .select(`
              id,
              titulo,
              orgao,
              banca,
              vagas,
              inscritos,
              created_at,
              status,
              watermark_image_url
            `)
            .order('created_at', { ascending: false });
          
          if (fallbackError) {
            devLog.error('Error loading concursos:', fallbackError);
            return;
          }
          
          // Processar dados do fallback
          const concursosWithParticipants = await Promise.all((fallbackData || []).map(async concurso => {
            // ✅ Para cards gerais, usar função RPC que soma participantes dos filhos
            let participantCount = 0;
            
            // Verificar se é card geral (se a coluna existir)
            if (concurso.is_general_card === true) {
              const { data: generalCount, error: generalError } = await supabase
                .rpc('get_general_card_participant_count', { p_general_card_id: concurso.id });
              
              if (generalError) {
                devLog.error('Error fetching general card participant count:', generalError);
                // Fallback: tentar calcular manualmente somando filhos
                const { data: childCards } = await supabase
                  .from('concursos')
                  .select('id')
                  .eq('parent_concurso_id', concurso.id);
                
                if (childCards && childCards.length > 0) {
                  const childCounts = await Promise.all(
                    childCards.map(async (child) => {
                      const { data: count } = await supabase
                        .rpc('count_concurso_participants', { concurso_id: child.id });
                      return count || 0;
                    })
                  );
                  participantCount = childCounts.reduce((sum, count) => sum + count, 0);
                }
              } else {
                participantCount = generalCount || 0;
              }
            } else {
              // Para cards normais, contar diretamente
              const { data: countData, error: countError } = await supabase
                .rpc('count_concurso_participants', { concurso_id: concurso.id });
              
              if (countError) {
                devLog.error('Error fetching participant count:', countError);
                participantCount = 0;
              } else {
                participantCount = countData || 0;
              }
            }
            
            return {
              ...concurso,
              participant_count: participantCount
            };
          }));
          
          setConcursos(concursosWithParticipants);
          return;
        }
        
        devLog.error('Error loading concursos:', error);
        return;
      }

      // Load participant count for each concurso
      const concursosWithParticipants = await Promise.all((data || []).map(async concurso => {
        // Filtrar apenas cards gerais (se a coluna existir)
        if (concurso.is_general_card === false || (concurso.parent_concurso_id && !concurso.is_general_card)) {
          return null;
        }
        
        let participantCount = 0;
        
        // ✅ Para cards gerais, usar função RPC que soma participantes dos filhos
        if (concurso.is_general_card === true) {
          const { data: generalCount, error: generalError } = await supabase
            .rpc('get_general_card_participant_count', { p_general_card_id: concurso.id });
          
          if (generalError) {
            devLog.error('Error fetching general card participant count:', generalError);
            // Fallback: tentar calcular manualmente somando filhos
            const { data: childCards } = await supabase
              .from('concursos')
              .select('id')
              .eq('parent_concurso_id', concurso.id);
            
            if (childCards && childCards.length > 0) {
              const childCounts = await Promise.all(
                childCards.map(async (child) => {
                  const { data: count } = await supabase
                    .rpc('count_concurso_participants', { concurso_id: child.id });
                  return count || 0;
                })
              );
              participantCount = childCounts.reduce((sum, count) => sum + count, 0);
            }
          } else {
            participantCount = generalCount || 0;
          }
        } else {
          // Para cards normais (não gerais), contar diretamente
          const { data: countData, error: countError } = await supabase
            .rpc('count_concurso_participants', { concurso_id: concurso.id });
          
          if (countError) {
            devLog.error('Error fetching participant count:', countError);
            participantCount = 0;
          } else {
            participantCount = countData || 0;
          }
        }
        
        return {
          ...concurso,
          participant_count: participantCount
        };
      }));
      
      // Filtrar nulls (cards de cargo que foram removidos)
      const filteredConcursos = concursosWithParticipants.filter(c => c !== null);
      setConcursos(filteredConcursos);
    } catch (error) {
      devLog.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };
  const filteredConcursos = concursos.filter(concurso => {
    const matchesSearch = concurso.titulo.toLowerCase().includes(searchTerm.toLowerCase()) || concurso.orgao.toLowerCase().includes(searchTerm.toLowerCase()) || concurso.banca.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || concurso.status === statusFilter;
    return matchesSearch && matchesStatus;
  }).sort((a, b) => {
    switch (sortBy) {
      case 'participants':
        return (b.participant_count || 0) - (a.participant_count || 0);
      case 'vagas':
        return (b.vagas || 0) - (a.vagas || 0);
      case 'recent':
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      default:
        return 0;
    }
  });
  const topConcursos = filteredConcursos.slice(0, 3);
  const totalParticipants = concursos.reduce((sum, c) => sum + (c.participant_count || 0), 0);
  const activeConcursos = concursos.filter(c => c.status === 'Em andamento').length;
  if (loading) {
    return <div className="page-content-container">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Trophy className="mx-auto h-12 w-12 text-muted-foreground mb-4 animate-pulse" />
            <p className="text-muted-foreground">Carregando rankings...</p>
          </div>
        </div>
      </div>;
  }
  return <div className="min-h-screen">
      <div className="page-content-container">
      <div className="mb-8 flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Rankings</h1>
          
        </div>
        <Button onClick={() => user ? navigate('/criar-ranking') : navigate('/auth', { state: { from: '/criar-ranking' } })} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Criar Ranking
        </Button>
      </div>

      {/* Stats Cards */}
      

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input placeholder="Buscar concursos..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10" />
        </div>
        
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Status</SelectItem>
            <SelectItem value="Em andamento">Em Andamento</SelectItem>
            <SelectItem value="Finalizado">Finalizado</SelectItem>
            <SelectItem value="Suspenso">Suspenso</SelectItem>
          </SelectContent>
        </Select>

        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Ordenar por" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="participants">Mais Participantes</SelectItem>
            <SelectItem value="vagas">Mais Vagas</SelectItem>
            <SelectItem value="recent">Mais Recentes</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="all">Concursos</TabsTrigger>
          <TabsTrigger value="popular">Populares</TabsTrigger>
          <TabsTrigger value="recent">Recentes</TabsTrigger>
        </TabsList>
        
        <TabsContent value="all" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2" style={{ gridAutoRows: '1fr' }}>
            {filteredConcursos.map(concurso => <div key={concurso.id} className="block group h-full cursor-pointer" onClick={(e) => handleRankingClick(e, concurso.id)}>
                <Card className="rounded-xl border border-border bg-card text-card-foreground shadow-lg hover:shadow-2xl transition-shadow duration-300 overflow-hidden cursor-pointer group-hover:-translate-y-0.5 relative h-full flex flex-col">
                  {/* Marca d'água */}
                  {concurso.watermark_image_url && (
                    <div 
                      className="absolute inset-0 pointer-events-none opacity-10 z-0"
                      style={{
                        backgroundImage: `url(${concurso.watermark_image_url})`,
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'center',
                        backgroundSize: 'cover'
                      }}
                    />
                  )}
                  
                  <CardHeader className="relative z-10 flex-shrink-0">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg line-clamp-2 mb-2">
                          {concurso.titulo}
                        </CardTitle>
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="secondary">{concurso.orgao}</Badge>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="relative z-10 flex-1 flex flex-col justify-end">
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Vagas:</span>
                        <span className="font-medium bg-transparent">{concurso.vagas || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Participantes:</span>
                        <span className="font-medium flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {concurso.participant_count || 0}
                        </span>
                      </div>
                      <div className="flex items-center justify-between pt-2">
                        <div className="flex items-center gap-2 text-sm font-medium text-primary">
                          <Trophy className="h-4 w-4" />
                          Ver Ranking
                        </div>
                        <span className="font-mono text-base font-bold text-primary bg-primary/10 px-2 py-1 rounded-md border border-primary/20">
                          {concurso.banca}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>)}
          </div>
          
          {filteredConcursos.length === 0 && <div className="text-center py-12">
              <Trophy className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">Nenhum concurso encontrado</h3>
              <p className="text-muted-foreground mb-4">
                Tente ajustar os filtros ou criar um novo ranking
              </p>
              <Button onClick={() => user ? navigate('/criar-ranking') : navigate('/auth', { state: { from: '/criar-ranking' } })}>
                Criar Novo Ranking
              </Button>
            </div>}
        </TabsContent>

        <TabsContent value="popular" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2" style={{ gridAutoRows: '1fr' }}>
            {topConcursos.map((concurso, index) => <div key={concurso.id} className="block group cursor-pointer h-full" onClick={(e) => handleRankingClick(e, concurso.id)}>
                <Card className="rounded-xl border border-border bg-card text-card-foreground shadow-lg hover:shadow-2xl transition-shadow duration-300 overflow-hidden cursor-pointer group-hover:-translate-y-0.5 h-full flex flex-col">
                  <CardHeader className="flex-shrink-0">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        {index === 0 && <Medal className="h-5 w-5 text-yellow-500" />}
                        {index === 1 && <Medal className="h-5 w-5 text-gray-400" />}
                        {index === 2 && <Medal className="h-5 w-5 text-orange-500" />}
                        <span className="font-semibold">#{index + 1}</span>
                      </div>
                      <Badge variant="default">{concurso.participant_count} participantes</Badge>
                    </div>
                    <CardTitle className="text-lg line-clamp-2">{concurso.titulo}</CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{concurso.orgao}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col justify-end">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm font-medium text-primary">
                        <Trophy className="h-4 w-4" />
                        Ver Ranking
                      </div>
                      <span className="font-mono text-sm font-semibold text-primary">
                        {concurso.banca}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>)}
          </div>
        </TabsContent>

        <TabsContent value="recent" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2" style={{ gridAutoRows: '1fr' }}>
            {concursos.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 6).map(concurso => <div key={concurso.id} className="block group cursor-pointer h-full" onClick={(e) => handleRankingClick(e, concurso.id)}>
                  <Card className="rounded-xl border border-border bg-card text-card-foreground shadow-lg hover:shadow-2xl transition-shadow duration-300 overflow-hidden cursor-pointer group-hover:-translate-y-0.5 h-full flex flex-col">
                    <CardHeader className="flex-shrink-0">
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-lg line-clamp-2 flex-1">{concurso.titulo}</CardTitle>
                        <Badge variant="secondary" className="ml-2">
                          <Calendar className="h-3 w-3 mr-1" />
                          Novo
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{concurso.orgao}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col justify-end">
                      <p className="text-sm text-muted-foreground mb-4">
                        Publicado em {concurso.created_at ? new Date(concurso.created_at).toLocaleDateString('pt-BR') : 'Data não informada'}
                      </p>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm font-medium text-primary">
                          <Trophy className="h-4 w-4" />
                          Ver Ranking
                        </div>
                        <span className="font-mono text-base font-bold text-primary bg-primary/10 px-2 py-1 rounded-md border border-primary/20">
                          {concurso.banca}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </div>)}
          </div>
        </TabsContent>
      </Tabs>
      </div>
    </div>;
};
export default RankingsPage;