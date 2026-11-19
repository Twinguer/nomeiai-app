import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { OnlineIndicator } from '@/components/profile/OnlineIndicator';
import { Separator } from '@/components/ui/separator';
import { Trophy, Users, ArrowLeft, UserPlus, EyeOff } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Link } from 'react-router-dom';
import { ProfileStatsColumn } from '@/components/profile/ProfileStatsColumn';
import { fetchPublicProfileRankingSummaries } from '@/modules/rankings';
import { profileService } from '@/modules/profile';
import { getAvatarUrl } from '@/utils/avatarUtils';
import { formatPublicNicknameHandle } from '@/utils/nicknameUtils';
import type { ProfilePrivacySettings } from '@/utils/profilePrivacySettings';

interface PublicUserProfileProps {
  userId?: string;
  secureToken?: string;
}

const PublicUserProfile: React.FC<PublicUserProfileProps> = ({ userId, secureToken }) => {
  // ✅ SEGURANÇA: userId já foi validado pelo SecureUserRoute
  // Não fazer validação adicional nem aceitar UUIDs diretamente
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // ✅ SEGURANÇA: Usar apenas userId passado pelo SecureUserRoute (já validado)
  React.useEffect(() => {
    if (!userId) {
      // Se não houver userId, redirecionar (não deve acontecer se SecureUserRoute funcionar)
      toast({
        title: 'Acesso negado',
        description: 'Token de acesso inválido ou expirado.',
        variant: 'destructive',
      });
      navigate('/comunidade');
    }
  }, [userId, navigate, toast]);

  // Usar userId diretamente (já validado pelo SecureUserRoute)
  const id = userId;
  const {
    data: profile,
    isLoading: profileLoading
  } = useQuery({
    queryKey: ['public-user-profile', id],
    queryFn: async () => {
      if (!id) return null;

      try {
        const profileData = await profileService.fetchPublicProfile(id);
        if (!profileData) throw new Error('User profile not found');
        return profileData;
      } catch (error) {
        toast({
          title: 'Erro',
          description: 'Não foi possível carregar o perfil do usuário.',
          variant: 'destructive',
        });
        throw error;
      }
    },
    enabled: !!id
  });

  const publicPrivacy: ProfilePrivacySettings = profile?.privacy ?? {
    showPublicRankings: false,
    showPublicStudyStats: false,
    showPublicRankingPosition: false,
    showPublicAboutInfo: false,
  };

  const { data: rankings } = useQuery({
    queryKey: ['public-user-rankings', id, publicPrivacy.showPublicRankingPosition],
    queryFn: () =>
      fetchPublicProfileRankingSummaries(id!, {
        includePosition: publicPrivacy.showPublicRankingPosition,
      }),
    enabled: !!id && publicPrivacy.showPublicRankings,
  });

  const getInitials = (name: string) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  };
  // ✅ SEGURANÇA: Mostrar loading enquanto carrega perfil
  if (profileLoading) {
    return <div className="container mx-auto p-4 flex justify-center items-center min-h-[60vh]">
        <div className="animate-spin h-8 w-8 border-primary rounded-full border-t-transparent"></div>
        <p className="ml-4 text-muted-foreground">
          Carregando perfil...
        </p>
      </div>;
  }
  
  // ✅ SEGURANÇA: Se não houver userId, não mostrar nada
  if (!id) {
    return null;
  }
  if (!profile) {
    return <div className="container mx-auto p-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Usuário não encontrado</h1>
          <p className="text-muted-foreground mb-6">O perfil que você está procurando não existe ou foi removido.</p>
          <Button onClick={() => navigate('/comunidade')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar para Comunidade
          </Button>
        </div>
      </div>;
  }

  // Processar as aprovações do usuário
  const aprovacoesList = profile.concursos_aprovados ? profile.concursos_aprovados.split('\n').filter(Boolean) : [];

  // Verificar se há informações de "Sobre mim"
  const hasAboutInfo =
    publicPrivacy.showPublicAboutInfo &&
    (profile.estado ||
      profile.formacao ||
      profile.cargo_atual ||
      profile.area_estudos ||
      profile.especialidade ||
      profile.curso_preparatorio);
  const showAboutContent = publicPrivacy.showPublicAboutInfo;
  const publicNicknameHandle = formatPublicNicknameHandle(profile.nickname);
  return <div className="container mx-auto p-6 max-w-7xl">
      
      
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Coluna Esquerda - Perfil do Usuário */}
        <div className="lg:col-span-3 space-y-4">
          <Card className="rounded-xl border border-border bg-card text-card-foreground shadow-lg hover:shadow-2xl transition-shadow duration-300 overflow-hidden" style={{ boxShadow: '0 8px 25px rgba(0, 0, 0, 0.15), 0 4px 10px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.05)' }}>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center space-y-4">
                <div className="relative">
                  <Avatar className="h-32 w-32" style={{ boxShadow: '0 8px 20px rgba(0, 0, 0, 0.5), 0 4px 8px rgba(0, 0, 0, 0.4), 0 2px 4px rgba(0, 0, 0, 0.3)' }}>
                    <AvatarImage src={getAvatarUrl(profile?.avatar_url)} alt={profile.name} />
                    <AvatarFallback className="text-3xl">
                      {getInitials(profile?.name || '')}
                    </AvatarFallback>
                  </Avatar>
                  <OnlineIndicator userId={profile?.id as string} />
                </div>
                
                <div className="text-center">
                  <h2 className="text-xl font-bold mb-1">
                    {profile?.name || 'Usuário'}
                  </h2>
                  {publicNicknameHandle && (
                    <p className="text-sm text-muted-foreground mb-1">{publicNicknameHandle}</p>
                  )}
                  {profile?.is_coach && (
                    <Badge className="bg-purple-100 text-purple-800 border-purple-300 hover:bg-purple-200 mb-2">
                      Coach
                    </Badge>
                  )}
                </div>
                
                {profile.profile_text && (
                  <p className="text-sm text-muted-foreground italic text-center px-2">
                    &ldquo;{profile.profile_text}&rdquo;
                  </p>
                )}

                <Separator />

                {showAboutContent && (
                  <div className="w-full">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Status</span>
                      <span className="text-sm">{profile.status_concurseiro || 'Estudando'}</span>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          
          {/* Sobre mim */}
          {hasAboutInfo && <Card className="rounded-xl border border-border bg-card text-card-foreground shadow-lg hover:shadow-2xl transition-shadow duration-300 overflow-hidden" style={{ boxShadow: '0 8px 25px rgba(0, 0, 0, 0.15), 0 4px 10px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.05)' }}>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Sobre mim</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-3 text-xs">
                  {profile.estado && <div className="flex justify-between">
                      <span className="font-medium">Estado:</span>
                      <span className="text-muted-foreground">{profile.estado}</span>
                    </div>}
                  {profile.formacao && <div className="flex justify-between">
                      <span className="font-medium">Formação:</span>
                      <span className="text-muted-foreground">{profile.formacao}</span>
                    </div>}
                  {profile.cargo_atual && <div className="flex justify-between">
                      <span className="font-medium">Cargo:</span>
                      <span className="text-muted-foreground">{profile.cargo_atual}</span>
                    </div>}
                  {profile.area_estudos && <div className="flex justify-between">
                      <span className="font-medium">Área de Estudos:</span>
                      <span className="text-muted-foreground">{profile.area_estudos}</span>
                    </div>}
                  {profile.especialidade && <div className="flex justify-between">
                      <span className="font-medium">Especialidade:</span>
                      <span className="text-muted-foreground">{profile.especialidade}</span>
                    </div>}
                  {profile.curso_preparatorio && <div className="flex justify-between">
                      <span className="font-medium">Curso Preparatório:</span>
                      <span className="text-muted-foreground">{profile.curso_preparatorio}</span>
                    </div>}
                </div>
              </CardContent>
            </Card>}
        </div>
        
        {/* Coluna Central - Conteúdo Principal */}
        <div className="lg:col-span-6 space-y-4">
          <div>
            {!showAboutContent && (
              <Card className="mb-6 rounded-xl border border-border bg-card text-card-foreground shadow-lg hover:shadow-2xl transition-shadow duration-300 overflow-hidden" style={{ boxShadow: '0 8px 25px rgba(0, 0, 0, 0.15), 0 4px 10px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.05)' }}>
                <CardContent className="py-8">
                  <div className="flex flex-col items-center text-center gap-3">
                    <div className="rounded-full bg-muted p-3">
                      <EyeOff className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <div className="space-y-1 max-w-md">
                      <p className="text-sm font-medium">Informações pessoais restritas</p>
                      <p className="text-sm text-muted-foreground">
                        Este usuário optou por não exibir publicamente rotina de estudos, aprovações e
                        demais dados de sobre mim.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Rotina de estudos */}
            {showAboutContent && profile.rotina_estudos && <Card className="mb-6 rounded-xl border border-border bg-card text-card-foreground shadow-lg hover:shadow-2xl transition-shadow duration-300 overflow-hidden" style={{ boxShadow: '0 8px 25px rgba(0, 0, 0, 0.15), 0 4px 10px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.05)' }}>
                <CardHeader className="pb-3">
                  <CardTitle>Rotina de estudos</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-line text-sm text-muted-foreground break-words overflow-wrap-anywhere">
                    {profile.rotina_estudos}
                  </p>
                </CardContent>
              </Card>}
            
            {/* Aprovações */}
            {showAboutContent && (
            <Card className="mb-6 rounded-xl border border-border bg-card text-card-foreground shadow-lg hover:shadow-2xl transition-shadow duration-300 overflow-hidden" style={{ boxShadow: '0 8px 25px rgba(0, 0, 0, 0.15), 0 4px 10px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.05)' }}>
              <CardHeader className="pb-3">
                <CardTitle>Aprovações</CardTitle>
              </CardHeader>
              <CardContent>
                {aprovacoesList.length > 0 ? <div className="space-y-2">
                    {aprovacoesList.map((concurso, index) => <div key={index} className="p-3 rounded-md bg-muted border">
                        <div className="flex items-center">
                          <div className="bg-primary/10 p-2 rounded-full mr-3">
                            <Trophy className="h-4 w-4 text-primary" />
                          </div>
                          <span className="text-sm font-medium">
                            {concurso.trim()}
                          </span>
                        </div>
                      </div>)}
                  </div> : <p className="text-sm text-muted-foreground">Nenhuma aprovação registrada ainda.</p>}
              </CardContent>
            </Card>
            )}
            
            {/* Rankings — só se o usuário optou por exibir no perfil público */}
            {publicPrivacy.showPublicRankings ? (
            <Card className="mb-6 rounded-xl border border-border bg-card text-card-foreground shadow-lg hover:shadow-2xl transition-shadow duration-300 overflow-hidden" style={{ boxShadow: '0 8px 25px rgba(0, 0, 0, 0.15), 0 4px 10px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.05)' }}>
              <CardHeader className="pb-3">
                <CardTitle>Rankings</CardTitle>
              </CardHeader>
              <CardContent>
                {!user ? <div className="text-center py-6">
                    <Trophy className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                    <p className="text-muted-foreground mb-4">
                      Você precisa estar cadastrado para visualizar os rankings.
                    </p>
                    <Button asChild>
                      <Link to="/auth" className="flex items-center">
                        <UserPlus className="mr-2 h-4 w-4" />
                        Cadastrar-se
                      </Link>
                    </Button>
                  </div> : rankings && rankings.length > 0 ? <div className="space-y-3">
                    {rankings.map((ranking, index) => <Card key={`${ranking.concursoId}-${index}`} className="p-4">
                        <div className="flex justify-between items-center">
                          <div className="flex-1">
                            <h4 className="font-medium text-sm mb-1">
                              {ranking.concursoTitle}
                            </h4>
                            {publicPrivacy.showPublicRankingPosition ? (
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground">
                                  Participando - {ranking.score} pts
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">Participando</span>
                            )}
                          </div>
                          {publicPrivacy.showPublicRankingPosition ? (
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">Classificação:</span>
                              {ranking.position ? <span className="font-bold text-primary">
                                  {ranking.position}º
                                </span> : <Badge variant="destructive" className="font-bold">
                                  E
                                </Badge>}
                            </div>
                          ) : null}
                        </div>
                      </Card>)}
                  </div> : <div className="text-center py-6">
                    <Trophy className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                    <p className="text-muted-foreground">
                      Nenhum ranking encontrado para este usuário.
                    </p>
                  </div>}
              </CardContent>
            </Card>
            ) : null}
          </div>
        </div>
        
        {/* Coluna Direita - Estatísticas e Grupos */}
        <div className="lg:col-span-3 space-y-4">
          {id && (
            <ProfileStatsColumn
              userId={id}
              rankings={rankings}
              showStudyStats={publicPrivacy.showPublicStudyStats}
              publicGroupsOnly
            />
          )}
        </div>
      </div>
    </div>;
};
export default PublicUserProfile;