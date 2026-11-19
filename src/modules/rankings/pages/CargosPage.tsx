import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { ArrowLeft, Plus, Users, Trophy, MapPin, Calendar } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { devLog, sanitizeForLog } from '@/utils/productionLogger';
import { UrlObfuscationService } from '@/services/urlObfuscation';
import { openSecureRankingWithFallback } from '@/modules/rankings';

const ESTADOS_BRASILEIROS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

// Helper para verificar se ├® UUID v├ílido
const isValidUUID = (str: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
};

const CargosPage = () => {
  const { id: idParam } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const searchParams = new URLSearchParams(window.location.search);
  const [selectedState, setSelectedState] = useState<string>(searchParams.get('state') || '');
  const [validatedId, setValidatedId] = useState<string | null>(null);
  const [isValidatingToken, setIsValidatingToken] = useState(false);

  // Ô£à Verificar autentica├º├úo: usu├írios n├úo cadastrados n├úo podem acessar
  useEffect(() => {
    if (!user) {
      navigate('/auth');
    }
  }, [user, navigate]);

  // Validar token se necess├írio
  useEffect(() => {
    const validateId = async () => {
      if (!idParam) return;

      // Se for UUID v├ílido, usar diretamente
      if (isValidUUID(idParam)) {
        setValidatedId(idParam);
        return;
      }

      // Se n├úo for UUID, provavelmente ├® um token ofuscado
      setIsValidatingToken(true);
      try {
        const validatedConcursoId = await UrlObfuscationService.validateConcursoToken(idParam);
        if (validatedConcursoId) {
          setValidatedId(validatedConcursoId);
        } else {
          devLog.error('Token inv├ílido ou expirado');
          navigate('/pre-classificacao');
        }
      } catch (error) {
        devLog.error('Erro ao validar token:', error);
        navigate('/pre-classificacao');
      } finally {
        setIsValidatingToken(false);
      }
    };

    validateId();
  }, [idParam, navigate]);

  // Buscar informa├º├Áes do card geral
  const { data: generalCard, isLoading: loadingGeneral } = useQuery({
    queryKey: ['general-card', validatedId],
    queryFn: async () => {
      if (!validatedId) return null;

      const { data, error } = await supabase
        .from('concursos')
        .select('*')
        .eq('id', validatedId)
        .eq('is_general_card', true)
        .single();

      if (error) {
        // Se is_general_card n├úo existir, a migra├º├úo n├úo foi aplicada
        if (error.message?.includes('is_general_card') || 
            error.message?.includes('does not exist')) {
          // Retornar null para indicar que a migra├º├úo precisa ser aplicada
          return null;
        }
        throw error;
      }
      // Garantir que is_unified existe
      return { ...data, is_unified: data.is_unified || false };
    },
    enabled: !!validatedId
  });

  // Buscar cargos do card geral
  const { data: cargos, isLoading: loadingCargos } = useQuery({
    queryKey: ['cargos', validatedId, selectedState],
    queryFn: async () => {
      if (!validatedId) return [];

      // Tentar buscar com todos os campos, se falhar, buscar sem os novos campos
      let query = supabase
        .from('concursos')
        .select(`
          id,
          titulo,
          orgao,
          banca,
          cargo,
          state_uf,
          localidades,
          created_at,
          status,
          total_participants,
          watermark_image_url,
          parent_concurso_id
        `)
        .eq('parent_concurso_id', validatedId);

      // Se for unificado e tiver estado selecionado, filtrar por estado
      if (generalCard?.is_unified && selectedState) {
        query = query.eq('state_uf', selectedState);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      
      // Herdar marca d'├ígua do parent para cargos que n├úo t├¬m pr├│pria
      const cargosWithWatermark = (data || []).map(cargo => {
        if (!cargo.watermark_image_url && generalCard?.watermark_image_url) {
          return {
            ...cargo,
            watermark_image_url: generalCard.watermark_image_url
          };
        }
        return cargo;
      });
      
      return cargosWithWatermark;
    },
    enabled: !!validatedId && !!generalCard
  });

  // Ô£à Se n├úo estiver autenticado, n├úo mostrar conte├║do
  if (!user) {
    return null; // Ser├í redirecionado pelo useEffect
  }

  // Se estiver validando token, mostrar loading
  if (isValidatingToken || !validatedId) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center items-center min-h-[60vh]">
          <p className="text-lg">Validando acesso...</p>
        </div>
      </div>
    );
  }

  if (loadingGeneral) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center items-center min-h-[60vh]">
          <p className="text-lg">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!generalCard) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="border-dashed border-2">
          <CardContent className="p-8 text-center">
            <p className="text-lg font-medium text-muted-foreground mb-2">
              {loadingGeneral ? 'Carregando...' : 'Card geral n├úo encontrado ou migra├º├úo n├úo aplicada.'}
            </p>
            {!loadingGeneral && (
              <p className="text-sm text-muted-foreground mb-4">
                A migra├º├úo SQL precisa ser aplicada para usar a funcionalidade de hierarquia de rankings.
              </p>
            )}
            <Button onClick={() => navigate('/pre-classificacao')} className="mt-4">
              Voltar para Rankings
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleCargoClick = async (cargoId: string) => {
    await openSecureRankingWithFallback(navigate, cargoId);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => navigate('/pre-classificacao')}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar para Rankings
        </Button>

        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground mb-2">
              {generalCard.titulo || generalCard.orgao || 'Concurso'}
            </h1>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <Badge variant="outline">{generalCard.banca}</Badge>
              {generalCard.localidades && Array.isArray(generalCard.localidades) && generalCard.localidades.length > 0 && (
                <div className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  <span>{generalCard.localidades.join(', ')}</span>
                </div>
              )}
            </div>
          </div>
          {user && !generalCard.is_unified && (
            <Link to={`/criar-ranking?parent=${validatedId}`}>
              <Button className="bg-emerald-600 hover:bg-emerald-700">
                <Plus className="h-4 w-4 mr-2" />
                Criar Ranking do Cargo
              </Button>
            </Link>
          )}
          {user && generalCard.is_unified && selectedState && (
            <Link to={`/criar-ranking?parent=${validatedId}&state=${selectedState}`}>
              <Button className="bg-emerald-600 hover:bg-emerald-700">
                <Plus className="h-4 w-4 mr-2" />
                Criar Ranking do Cargo
              </Button>
            </Link>
          )}
        </div>

      </div>

      {/* Se for unificado e n├úo tiver estado selecionado, mostrar lista de estados */}
      {generalCard.is_unified && !selectedState && (
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-4">Selecione um Estado</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {ESTADOS_BRASILEIROS.map((estado) => (
              <Card
                key={estado}
                className="hover:shadow-lg transition-all duration-300 cursor-pointer hover:translate-y-[-4px]"
                onClick={async () => {
                  setSelectedState(estado);
                  // Usar URL ofuscada para seguran├ºa
                  try {
                    const secureUrl = await UrlObfuscationService.generateSecureCargosUrl(validatedId, estado);
                    navigate(secureUrl, { replace: true });
                  } catch (error) {
                    devLog.error('Erro ao gerar URL segura:', error);
                    // Fallback apenas em caso de erro cr├¡tico
                    navigate(`/pre-classificacao/${validatedId}/cargos?state=${estado}`, { replace: true });
                  }
                }}
              >
                <CardContent className="p-4 text-center">
                  <p className="font-semibold text-lg">{estado}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Se for unificado e tiver estado selecionado, mostrar breadcrumb e bot├úo voltar */}
      {generalCard.is_unified && selectedState && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                setSelectedState('');
                // Usar URL ofuscada para seguran├ºa
                try {
                  const secureUrl = await UrlObfuscationService.generateSecureCargosUrl(validatedId);
                  navigate(secureUrl, { replace: true });
                } catch (error) {
                  devLog.error('Erro ao gerar URL segura:', error);
                  // Fallback apenas em caso de erro cr├¡tico
                  navigate(`/pre-classificacao/${validatedId}/cargos`, { replace: true });
                }
              }}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar para Estados
            </Button>
            <span className="text-muted-foreground">/</span>
            <Badge variant="secondary" className="text-sm">
              {selectedState}
            </Badge>
          </div>
        </div>
      )}

      {/* Se for unificado e n├úo tiver estado selecionado, n├úo mostrar cargos ainda */}
      {generalCard.is_unified && !selectedState ? null : (
        <>
          {loadingCargos ? (
            <div className="flex justify-center items-center min-h-[40vh]">
              <p className="text-lg">Carregando cargos...</p>
            </div>
          ) : cargos && cargos.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4" style={{ gridAutoRows: '1fr' }}>
          {cargos.map((cargo) => {
            // Herdar marca d'├ígua do card geral se o cargo n├úo tiver pr├│pria
            const watermarkUrl = cargo.watermark_image_url || generalCard?.watermark_image_url;
            
            // Debug: verificar localidades dispon├¡veis
            // devLog.log('Cargo:', cargo.cargo, 'localidades:', cargo.localidades, 'generalCard localidades:', generalCard?.localidades);
            
            return (
              <div key={cargo.id} className="block h-full cursor-pointer" onClick={() => handleCargoClick(cargo.id)}>
                <Card className="hover:shadow-lg transition-all duration-300 hover:translate-y-[-4px] h-full cursor-pointer relative overflow-hidden">
                  {watermarkUrl && (
                    <div 
                      className="absolute inset-0 pointer-events-none opacity-10 z-0"
                      style={{
                        backgroundImage: `url(${watermarkUrl})`,
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'center',
                        backgroundSize: 'cover'
                      }}
                    />
                  )}
                  <CardContent className="p-6 pt-6 h-full flex flex-col relative z-10">
                    <div className="space-y-3 flex-1 flex flex-col">
                      <div className="flex justify-between items-start">
                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-semibold text-muted-foreground">Cargo</span>
                          <h3 className="text-base font-bold leading-tight text-foreground line-clamp-2">
                            {cargo.cargo}
                          </h3>
                        </div>
                        <div className="flex flex-col gap-1 items-end">
                          <Badge variant="outline" className={`text-xs font-medium border-0 ${
                            !cargo.status || cargo.status === 'Em andamento' 
                              ? 'bg-primary/10 hover:bg-primary/20 text-primary' 
                              : ''
                          }`}>
                            {cargo.status || 'Em andamento'}
                          </Badge>
                          {cargo.created_at && (
                            <div className="flex items-center text-xs text-muted-foreground">
                              <Calendar className="h-3 w-3 mr-1" />
                              {formatDate(cargo.created_at)}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex-1">
                        {/* Mostrar localidade: state_uf se for unificado, ou localidades se n├úo for */}
                        {(() => {
                          // Se for unificado, mostrar state_uf
                          if (generalCard?.is_unified && cargo.state_uf) {
                            return (
                              <div className="flex items-center text-xs text-muted-foreground mb-2">
                                <MapPin className="h-3 w-3 mr-1 flex-shrink-0" />
                                <span className="truncate">{cargo.state_uf}</span>
                              </div>
                            );
                          }
                          
                          // Se n├úo for unificado, mostrar localidades (do cargo ou herdado do geral)
                          // Priorizar localidades do cargo, depois do geral
                          let localidades = null;
                          
                          // Primeiro tentar do cargo
                          if (cargo.localidades && Array.isArray(cargo.localidades) && cargo.localidades.length > 0) {
                            localidades = cargo.localidades;
                          } 
                          // Se n├úo tiver, tentar do card geral
                          else if (generalCard?.localidades && Array.isArray(generalCard.localidades) && generalCard.localidades.length > 0) {
                            localidades = generalCard.localidades;
                          }
                          
                          if (localidades && localidades.length > 0) {
                            let localidadeText = '';
                            if (localidades.includes('Nacional')) {
                              localidadeText = 'Nacional';
                            } else if (localidades.length > 3) {
                              localidadeText = `${localidades.slice(0, 3).join(', ')} e outras`;
                            } else {
                              localidadeText = localidades.join(', ');
                            }
                            
                            return (
                              <div className="flex items-center text-xs text-muted-foreground mb-2">
                                <MapPin className="h-3 w-3 mr-1 flex-shrink-0" />
                                <span className="truncate">{localidadeText}</span>
                              </div>
                            );
                          }
                          
                          return null;
                        })()}
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-border">
                        <div className="flex items-center gap-1">
                          <Users className="h-4 w-4 text-primary flex-shrink-0" />
                          <p className="text-sm font-medium text-primary whitespace-nowrap">
                            {(cargo.total_participants || 0).toLocaleString()} participantes
                          </p>
                        </div>
                        
                        <div className="flex items-center gap-2 text-sm font-medium text-primary whitespace-nowrap">
                          <Trophy className="h-4 w-4 flex-shrink-0" />
                          Ver Ranking
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>
      ) : (
        <Card className="border-dashed border-2">
          <CardContent className="p-8 text-center">
            <Trophy className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-lg font-medium text-muted-foreground">
              {generalCard.is_unified && selectedState 
                ? `Nenhum cargo criado para ${selectedState} ainda.`
                : 'Nenhum cargo criado ainda.'}
            </p>
            {user && (
              <Link to={generalCard.is_unified && selectedState 
                ? `/criar-ranking?parent=${validatedId}&state=${selectedState}`
                : `/criar-ranking?parent=${validatedId}`}>
                <Button className="mt-4 bg-emerald-600 hover:bg-emerald-700">
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Primeiro Cargo
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      )}
        </>
      )}
    </div>
  );
};

export default CargosPage;

