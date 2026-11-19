import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Check, Loader2, Timer } from 'lucide-react';
import { ProfileStatsColumn } from '@/components/profile/ProfileStatsColumn';
import Logo from '@/assets/logo';
import ProfileInfoTab from '@/components/profile/ProfileInfoTab';
import ProfileHeader from '@/components/profile/ProfileHeader';
import DeleteProfileButton from '@/components/profile/DeleteProfileButton';
import CombinedRankingsTab from '@/components/profile/CombinedRankingsTab';
import { PrivacySettings } from '@/components/profile/PrivacySettings';
import { ProfileNicknameCard } from '@/components/profile/ProfileNicknameCard';
import { profileService, useProfileNickname } from '@/modules/profile';
import { fetchUserRankingSummaries } from '@/modules/rankings';
import { devLog } from '@/utils/productionLogger';
import {
  DEFAULT_PROFILE_PRIVACY,
  parseProfilePrivacySettings,
  type ProfilePrivacySettings,
} from '@/utils/profilePrivacySettings';

const profileCardClass =
  'rounded-xl border border-border bg-card text-card-foreground shadow-lg transition-shadow duration-300 overflow-hidden';

const UserProfile = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [name, setName] = useState('');
  const [concursosAprovados, setConcursosAprovados] = useState('');
  const [concursosParticipando, setConcursosParticipando] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingPrivacy, setSavingPrivacy] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [statusConcurseiro, setStatusConcurseiro] = useState('Na Ativa');
  const [profileText, setProfileText] = useState('');
  const [estado, setEstado] = useState('');
  const [formacao, setFormacao] = useState('');
  const [cargoAtual, setCargoAtual] = useState('');
  const [areaEstudos, setAreaEstudos] = useState('');
  const [especialidade, setEspecialidade] = useState('');
  const [cursoPreparatorio, setCursoPreparatorio] = useState('');
  const [rotinaEstudos, setRotinaEstudos] = useState('');
  const [privacySettings, setPrivacySettings] = useState<ProfilePrivacySettings>(DEFAULT_PROFILE_PRIVACY);

  const {
    data: profile,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['user-profile', user?.id],
    queryFn: async () => {
      if (!user) return null;
      try {
        return await profileService.fetchOrCreate(user);
      } catch (err) {
        devLog.error('Error in profile query:', err);
        toast({
          title: 'Erro ao carregar perfil',
          description: 'Não foi possível carregar os dados do perfil. Tente novamente.',
          variant: 'destructive',
        });
        throw err;
      }
    },
    enabled: !!user,
    refetchOnWindowFocus: false,
    staleTime: 300000,
  });

  const nickname = useProfileNickname(user?.id, profile?.nickname, refetch);

  const { data: isCoach } = useQuery({
    queryKey: ['user-is-coach', user?.id],
    queryFn: () => profileService.isUserCoach(user!.id),
    enabled: !!user,
  });

  const { data: userRankings = [] } = useQuery({
    queryKey: ['user-rankings-for-stats', user?.id],
    queryFn: () => fetchUserRankingSummaries(user!.id),
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (!user) navigate('/auth');
  }, [user, navigate]);

  useEffect(() => {
    if (!profile) return;
    setName(profile.name || '');
    setConcursosAprovados(profile.concursos_aprovados || '');
    setConcursosParticipando(profile.concursos_participando || '');
    setAvatarUrl(profile.avatar_url);
    setStatusConcurseiro(profile.status_concurseiro || 'Na Ativa');
    setProfileText(profile.profile_text || '');
    setEstado(profile.estado || '');
    setFormacao(profile.formacao || '');
    setCargoAtual(profile.cargo_atual || '');
    setAreaEstudos(profile.area_estudos || '');
    setEspecialidade(profile.especialidade || '');
    setCursoPreparatorio(profile.curso_preparatorio || '');
    setRotinaEstudos(profile.rotina_estudos || '');
    setPrivacySettings(parseProfilePrivacySettings(profile.privacy_settings));
  }, [profile]);

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!user || !event.target.files?.length) return;

    try {
      setUploading(true);
      const publicUrl = await profileService.uploadAvatar(user.id, event.target.files[0]);
      setAvatarUrl(publicUrl);
      toast({
        title: 'Foto de perfil atualizada',
        description: 'Sua foto de perfil foi atualizada com sucesso.',
      });
      await refetch();
    } catch (error: unknown) {
      devLog.error('Avatar upload error:', error);
      toast({
        title: 'Erro ao fazer upload',
        description: error instanceof Error ? error.message : 'Ocorreu um erro ao enviar a imagem.',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const handlePrivacyChange = async (key: keyof ProfilePrivacySettings, value: boolean) => {
    if (!user) return;

    const next: ProfilePrivacySettings = {
      ...privacySettings,
      [key]: value,
    };
    if (key === 'showPublicRankings' && !value) {
      next.showPublicRankingPosition = false;
    }

    setPrivacySettings(next);
    setSavingPrivacy(true);

    try {
      await profileService.updatePrivacySettings(user.id, next);
    } catch (error: unknown) {
      setPrivacySettings(privacySettings);
      toast({
        title: 'Erro ao salvar privacidade',
        description: error instanceof Error ? error.message : 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setSavingPrivacy(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;

    try {
      setSaving(true);
      await profileService.updateProfile(user.id, {
        name,
        profile_text: profileText,
        concursos_aprovados: concursosAprovados,
        concursos_participando: concursosParticipando,
        avatar_url: avatarUrl,
        status_concurseiro: statusConcurseiro,
        estado,
        formacao,
        cargo_atual: cargoAtual,
        area_estudos: areaEstudos,
        especialidade,
        curso_preparatorio: cursoPreparatorio,
        rotina_estudos: rotinaEstudos,
        privacy_settings: privacySettings,
      });

      toast({
        title: 'Perfil atualizado',
        description: 'Seu perfil foi atualizado com sucesso.',
      });
      await refetch();
    } catch (error: unknown) {
      devLog.error('Save profile error:', error);
      toast({
        title: 'Erro ao salvar',
        description: error instanceof Error ? error.message : 'Ocorreu um erro ao salvar o perfil.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading || !user) {
    return (
      <div className="container mx-auto p-4 flex justify-center items-center min-h-[60vh]">
        <div className="animate-spin h-8 w-8 border-4 border-emerald-600 rounded-full border-t-transparent" />
      </div>
    );
  }

  const hasAboutPreview =
    estado || formacao || cargoAtual || areaEstudos || especialidade || cursoPreparatorio;

  return (
    <div className="container mx-auto p-4 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-3 space-y-4">
          <Card className={profileCardClass}>
            <CardContent className="pt-6">
              <ProfileHeader
                name={name}
                email={user.email || ''}
                avatarUrl={avatarUrl}
                uploading={uploading}
                handleAvatarUpload={handleAvatarUpload}
                statusConcurseiro={statusConcurseiro}
                profileText={profileText}
                isCoach={isCoach || false}
                nickname={nickname.nickname}
              />
            </CardContent>
          </Card>

          <ProfileNicknameCard nickname={nickname} />

          <Card className={profileCardClass}>
            <CardHeader className="pb-2">
              <h3 className="text-lg font-semibold">Sobre mim</h3>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2 text-xs">
                {estado && (
                  <div className="flex justify-between">
                    <span className="font-medium">Estado:</span>
                    <span className="text-muted-foreground">{estado}</span>
                  </div>
                )}
                {formacao && (
                  <div className="flex justify-between">
                    <span className="font-medium">Formação:</span>
                    <span className="text-muted-foreground">{formacao}</span>
                  </div>
                )}
                {cargoAtual && (
                  <div className="flex justify-between">
                    <span className="font-medium">Cargo atual:</span>
                    <span className="text-muted-foreground">{cargoAtual}</span>
                  </div>
                )}
                {areaEstudos && (
                  <div className="flex justify-between">
                    <span className="font-medium">Área de Estudos:</span>
                    <span className="text-muted-foreground">{areaEstudos}</span>
                  </div>
                )}
                {especialidade && (
                  <div className="flex justify-between">
                    <span className="font-medium">Especialidade:</span>
                    <span className="text-muted-foreground">{especialidade}</span>
                  </div>
                )}
                {cursoPreparatorio && (
                  <div className="flex justify-between">
                    <span className="font-medium">Curso Preparatório:</span>
                    <span className="text-muted-foreground">{cursoPreparatorio}</span>
                  </div>
                )}
                {!hasAboutPreview && (
                  <p className="text-muted-foreground italic text-center">
                    Adicione informações na aba Perfil
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-6">
          <Card className={`mb-4 ${profileCardClass}`}>
            <CardHeader>
              <CardTitle className="text-2xl">Meu Perfil</CardTitle>
            </CardHeader>

            {rotinaEstudos && (
              <CardContent className="pt-0 pb-4">
                <Card className={profileCardClass}>
                  <CardHeader className="pb-2">
                    <h3 className="text-lg font-semibold">Rotina de estudos</h3>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-sm whitespace-pre-line break-words">{rotinaEstudos}</p>
                  </CardContent>
                </Card>
              </CardContent>
            )}

            <Tabs defaultValue="profile">
              <div className="px-6">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="profile">Perfil</TabsTrigger>
                  <TabsTrigger value="rankings">Rankings</TabsTrigger>
                  <TabsTrigger value="privacidade">Privacidade</TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="profile">
                <CardContent className="pt-6">
                  <ProfileInfoTab
                    name={name}
                    setName={setName}
                    email={user.email || ''}
                    statusConcurseiro={statusConcurseiro}
                    setStatusConcurseiro={setStatusConcurseiro}
                    profileText={profileText}
                    setProfileText={setProfileText}
                    concursosAprovados={concursosAprovados}
                    setConcursosAprovados={setConcursosAprovados}
                    concursosParticipando={concursosParticipando}
                    setConcursosParticipando={setConcursosParticipando}
                    estado={estado}
                    setEstado={setEstado}
                    formacao={formacao}
                    setFormacao={setFormacao}
                    cargoAtual={cargoAtual}
                    setCargoAtual={setCargoAtual}
                    areaEstudos={areaEstudos}
                    setAreaEstudos={setAreaEstudos}
                    especialidade={especialidade}
                    setEspecialidade={setEspecialidade}
                    cursoPreparatorio={cursoPreparatorio}
                    setCursoPreparatorio={setCursoPreparatorio}
                    rotinaEstudos={rotinaEstudos}
                    setRotinaEstudos={setRotinaEstudos}
                  />
                </CardContent>
              </TabsContent>

              <TabsContent value="privacidade">
                <CardContent className="pt-6">
                  {savingPrivacy && (
                    <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Salvando privacidade...
                    </p>
                  )}
                  <PrivacySettings settings={privacySettings} onSettingChange={handlePrivacyChange} />
                </CardContent>
              </TabsContent>

              <TabsContent value="rankings">
                <CardContent className="pt-6">
                  <CombinedRankingsTab userId={user.id} isAuthenticated />
                </CardContent>
              </TabsContent>
            </Tabs>

            <CardFooter className="flex justify-between py-6 border-t">
              <DeleteProfileButton userId={user.id} />
              <Button onClick={handleSaveProfile} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Salvar alterações
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        </div>

        <div className="lg:col-span-3">
          <ProfileStatsColumn userId={user.id} rankings={userRankings} />
        </div>
      </div>

      <footer className="mt-12 text-center">
        <div className="container mx-auto flex flex-col md:flex-row items-center justify-between">
          <Logo className="h-16 w-auto mb-4 md:mb-0" />
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Nomeia Aí - Todos os direitos reservados
          </p>
        </div>
      </footer>
    </div>
  );
};

export default UserProfile;
