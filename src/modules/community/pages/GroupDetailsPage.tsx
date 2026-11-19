import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Upload, Loader2 } from 'lucide-react';
import { 
  ArrowLeft, 
  Users, 
  GraduationCap, 
  Globe, 
  Lock, 
  UserPlus,
  Settings,
  LogOut,
  BookOpen
} from 'lucide-react';
import { useStudyGroup } from '../hooks/useStudyGroups';
import { useGroupFeed } from '../hooks/useGroupPosts';
import { useGroupMembers, useIsGroupMember, useRequestToJoin, useLeaveGroup } from '../hooks/useGroupMembers';
import { usePendingRequests, useRespondToRequest } from '../hooks/useGroupRequests';
import { useAuth } from '@/hooks/useAuth';
import { PostCard } from '../components/groups/PostCard';
import { CreatePostForm } from '../components/groups/CreatePostForm';
import { GroupSettingsButton } from '../components/groups/GroupSettingsButton';
import { getAvatarUrl } from '@/utils/avatarUtils';
import { validateFileUploadSimple } from '@/utils/fileUploadValidator';
import { CommunityLoadingState } from '../components/shared/CommunityLoadingState';
import { CommunityErrorState } from '../components/shared/CommunityErrorState';
import { GroupMembersColumn } from '../components/groups/GroupMembersColumn';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { studyGroupService } from '../services/studyGroupService';
import { usePlanLimits } from '@/modules/payments';
import { useToast } from '@/hooks/use-toast';
import { devLog, sanitizeForLog } from '@/utils/productionLogger';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export const GroupDetailsPage: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { canAccessStudyGroups, isLoading: isLoadingPlanLimits } = usePlanLimits();

  React.useEffect(() => {
    if (!user?.id || isLoadingPlanLimits) return;
    if (!canAccessStudyGroups) {
      toast({
        title: 'Grupos disponíveis apenas para assinantes',
        description: 'Assine o plano Pro ou o Modo Coach para acessar grupos de estudos.',
        variant: 'destructive',
      });
      navigate('/planos');
    }
  }, [canAccessStudyGroups, isLoadingPlanLimits, user?.id, navigate, toast]);

  const { group, isLoading: isLoadingGroup, isError: isErrorGroup, refetch: refetchGroup } = useStudyGroup(groupId);
  const { posts, isLoading: isLoadingPosts, refetch: refetchPosts, isError: isErrorPosts } = useGroupFeed(groupId);
  const { members, isLoading: isLoadingMembers, refetch: refetchMembers } = useGroupMembers(groupId);
  const { isMember, isAdmin, hasRequested, isInvited, isLoading: isLoadingMemberStatus } = useIsGroupMember(groupId);
  const requestToJoin = useRequestToJoin();
  const leaveGroup = useLeaveGroup();
  const { requests: pendingRequests, refetch: refetchRequests } = usePendingRequests(isAdmin ? groupId : undefined);
  const respondToRequest = useRespondToRequest();

  const [isLeaving, setIsLeaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);

  const handleRequestJoin = async () => {
    if (!groupId || !user) {
      navigate('/auth');
      return;
    }
    await requestToJoin.mutateAsync(groupId);
  };

  const handleAcceptRequest = async (memberId: string) => {
    if (!groupId) return;
    await respondToRequest.mutateAsync({ memberId, groupId, accept: true });
  };

  const handleRejectRequest = async (memberId: string) => {
    if (!groupId) return;
    await respondToRequest.mutateAsync({ memberId, groupId, accept: false });
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!groupId || !isAdmin || !event.target.files || !event.target.files.length) {
      return;
    }

    try {
      const file = event.target.files[0];
      
      // Validar arquivo usando o sistema padronizado
      const validation = validateFileUploadSimple(file, 'GROUP_COVER', true);
      
      if (!validation.isValid) {
        toast({
          title: 'Arquivo inválido',
          description: validation.errors.join('. '),
          variant: 'destructive'
        });
        return;
      }
      
      const fileExt = file.name.split('.').pop();
      const fileName = `group-${groupId}-${Date.now()}.${fileExt}`;
      const filePath = `groups/${fileName}`;
      
      setUploadingAvatar(true);

      // Upload para storage (usando bucket 'profiles' ou criar 'groups')
      const { data, error: uploadError } = await supabase.storage
        .from('profiles')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) {
        devLog.error("Upload error:", uploadError);
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('profiles')
        .getPublicUrl(filePath);

      // Atualizar grupo com nova URL do avatar
      await studyGroupService.updateGroup(groupId, {
        cover_image_url: publicUrl
      });

      toast({
        title: 'Foto do grupo atualizada',
        description: 'A foto do grupo foi atualizada com sucesso.'
      });

      // Atualizar cache
      queryClient.invalidateQueries({ queryKey: ['study-group', groupId] });
      refetchGroup();
    } catch (error: any) {
      devLog.error("Avatar upload error:", error);
      toast({
        title: 'Erro ao fazer upload',
        description: error.message || 'Ocorreu um erro ao enviar a imagem. Tente novamente.',
        variant: 'destructive'
      });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleLeave = async () => {
    if (!groupId) return;
    setIsLeaving(true);
    try {
      await leaveGroup.mutateAsync(groupId);
      setShowLeaveDialog(false);
      navigate('/comunidade');
    } catch (error: any) {
      devLog.error('Erro ao sair do grupo:', error);
      toast({
        title: 'Erro ao sair do grupo',
        description: error.message || 'Não foi possível sair do grupo. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsLeaving(false);
    }
  };

  if (isLoadingGroup) return <CommunityLoadingState />;
  if (isErrorGroup || !group) return <CommunityErrorState />;

  const privacyIcon = group.privacy_level === 'public' ? (
    <Globe className="h-4 w-4" />
  ) : (
    <Lock className="h-4 w-4" />
  );

  const timeAgo = formatDistanceToNow(new Date(group.created_at), {
    addSuffix: true,
    locale: ptBR,
  });

  const getInitials = (name: string) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  };

  return (
    <div className="min-h-screen bg-page-background">
      <div className="container mx-auto p-6 max-w-7xl">
        {/* Header com botão voltar */}
        <div className="flex items-center gap-4 mb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/comunidade')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 lg:grid-cols-12 gap-2">
          {/* Coluna Esquerda - Perfil do Grupo */}
          <div className="lg:col-span-3 space-y-4">
            <Card className="rounded-xl border border-border bg-card text-card-foreground shadow-lg hover:shadow-2xl transition-shadow duration-300 overflow-hidden" style={{ boxShadow: '0 8px 25px rgba(0, 0, 0, 0.15), 0 4px 10px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.05)' }}>
              <CardContent className="pt-6">
                <div className="flex flex-col items-center space-y-4">
                  {/* Avatar do Grupo */}
                  <div className="relative">
                    <Avatar className="h-32 w-32" style={{ boxShadow: '0 8px 20px rgba(0, 0, 0, 0.5), 0 4px 8px rgba(0, 0, 0, 0.4), 0 2px 4px rgba(0, 0, 0, 0.3)' }}>
                      {group.cover_image_url ? (
                        <AvatarImage src={group.cover_image_url} alt={group.name} />
                      ) : (
                        <AvatarFallback className="text-3xl bg-gradient-to-br from-purple-500 to-blue-500 text-white">
                          <BookOpen className="h-16 w-16" />
                        </AvatarFallback>
                      )}
                    </Avatar>
                  </div>
                  
                  <div className="text-center">
                    <h2 className="text-xl font-bold mb-2">
                      {group.name}
                    </h2>
                    <div className="flex items-center justify-center gap-2 flex-wrap mb-2">
                      {group.coach_id && (
                        <Badge className="bg-purple-100 text-purple-800 border-purple-300 hover:bg-purple-200">
                          <UserPlus className="h-3 w-3 mr-1" />
                          Com Coach
                        </Badge>
                      )}
                      {privacyIcon}
                      <span className="text-xs text-muted-foreground">
                        {group.privacy_level === 'public' ? 'Público' : 'Privado'}
                      </span>
                    </div>
                    
                    {/* Botão de upload de foto (apenas para admins) */}
                    {isAdmin && (
                      <div className="mt-2">
                        <Label htmlFor="group-avatar" className="cursor-pointer text-sm text-blue-600 hover:text-blue-800">
                          {uploadingAvatar ? (
                            <div className="flex items-center gap-2 justify-center">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Enviando...
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 justify-center">
                              <Upload className="h-4 w-4" />
                              Alterar foto
                            </div>
                          )}
                        </Label>
                        <Input 
                          id="group-avatar" 
                          type="file" 
                          className="hidden" 
                          onChange={handleAvatarUpload}
                          accept="image/*"
                          disabled={uploadingAvatar}
                        />
                      </div>
                    )}
                  </div>
                  
                  <Separator />
                  
                  {/* Informações do Grupo */}
                  <div className="w-full space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Membros</span>
                      <span className="text-sm">{group.current_members} / {group.max_members}</span>
                    </div>
                    {group.focus_area && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Área</span>
                        <Badge variant="outline" className="text-xs">
                          <GraduationCap className="h-3 w-3 mr-1" />
                          {group.focus_area}
                        </Badge>
                      </div>
                    )}
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Criado</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(group.created_at).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                  </div>

                  <Separator />

                  {/* Ações */}
                  <div className="w-full space-y-2">
                    {isMember && (
                      <>
                        {group.created_by !== user?.id && (
                          <>
                          <Button
                            variant="outline"
                            className="w-full"
                              onClick={() => setShowLeaveDialog(true)}
                            disabled={isLeaving}
                          >
                            <LogOut className="h-4 w-4 mr-2" />
                              Sair do Grupo
                            </Button>
                            <AlertDialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Sair do Grupo?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Você tem certeza que deseja sair do grupo <strong>{group.name}</strong>? 
                                    Você não poderá mais ver os posts e interagir com os membros. 
                                    Esta ação pode ser revertida solicitando entrada novamente.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel disabled={isLeaving}>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction 
                                    onClick={handleLeave} 
                                    className="bg-destructive hover:bg-destructive/90"
                                    disabled={isLeaving}
                                  >
                            {isLeaving ? 'Saindo...' : 'Sair do Grupo'}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </>
                        )}
                        {isAdmin && (
                          <GroupSettingsButton group={group} onGroupUpdated={() => {
                            refetchGroup();
                            refetchMembers();
                            refetchPosts();
                          }} />
                        )}
                      </>
                    )}

                    {!isMember && user && !hasRequested && (
                      <>
                        {/* Grupos públicos: permitir solicitação */}
                        {group.privacy_level === 'public' && (
                      <Button
                        className="w-full"
                        onClick={handleRequestJoin}
                        disabled={requestToJoin.isPending}
                      >
                        <UserPlus className="h-4 w-4 mr-2" />
                        {isInvited
                          ? 'Aceitar Convite'
                          : requestToJoin.isPending 
                            ? 'Enviando...' 
                            : 'Solicitar Entrada'}
                      </Button>
                        )}
                        
                        {/* Grupos privados: apenas por convite */}
                        {(group.privacy_level === 'private' || group.privacy_level === 'invite_only') && (
                          <div className="text-center p-3 bg-muted rounded-md">
                            <Lock className="h-4 w-4 mx-auto mb-2 text-muted-foreground" />
                            <p className="text-sm text-muted-foreground">
                              Este grupo é privado. Apenas membros convidados podem participar.
                            </p>
                          </div>
                        )}
                      </>
                    )}

                    {!isMember && user && hasRequested && (
                      <Badge variant="outline" className="w-full justify-center py-2">
                        Pedido Enviado
                      </Badge>
                    )}

                    {!user && (
                      <Button
                        className="w-full"
                        onClick={() => navigate('/auth')}
                      >
                        Faça login para participar
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* Descrição do Grupo */}
            {group.description && (
              <Card className="rounded-xl border border-border bg-card text-card-foreground shadow-lg hover:shadow-2xl transition-shadow duration-300 overflow-hidden" style={{ boxShadow: '0 8px 25px rgba(0, 0, 0, 0.15), 0 4px 10px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.05)' }}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Sobre o Grupo</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-sm text-muted-foreground whitespace-pre-line break-words">
                    {group.description}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Pedidos Pendentes (apenas para admins) */}
            {isAdmin && pendingRequests && pendingRequests.length > 0 && (
              <Card className="border-border bg-card">
                <CardHeader>
                  <CardTitle className="text-lg">Pedidos Pendentes</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {pendingRequests.map((request: any) => (
                    <div key={request.id} className="p-3 bg-muted/50 rounded-lg border border-border">
                      <div className="flex items-center gap-3 mb-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={getAvatarUrl(request.avatar_url)} />
                          <AvatarFallback>{getInitials(request.name || '')}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-sm text-foreground">{request.name}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => handleAcceptRequest(request.id)}
                          disabled={respondToRequest.isPending}
                          className="flex-1"
                        >
                          Aceitar
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleRejectRequest(request.id)}
                          disabled={respondToRequest.isPending}
                          className="flex-1"
                        >
                          Rejeitar
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Coluna Central - Feed (estilo Facebook) */}
          <div className="lg:col-span-6 space-y-4">
            {/* Formulário de criação de post (apenas membros) - Estilo Facebook */}
            {(isLoadingMembers || isLoadingMemberStatus) ? (
              <Card className="rounded-lg">
                <CardContent className="py-6 text-center">
                  <p className="text-sm text-muted-foreground">Verificando permissões...</p>
                </CardContent>
              </Card>
            ) : isMember ? (
              <CreatePostForm
                groupId={group.id}
                onPostCreated={() => refetchPosts()}
              />
            ) : (
              <Card className="rounded-lg border-dashed">
                <CardContent className="py-6 text-center">
                  <p className="text-sm text-muted-foreground">
                    {user
                      ? 'Solicite entrada no grupo na barra lateral para criar posts e interagir.'
                      : 'Faça login e solicite entrada no grupo para criar posts e interagir.'}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Feed de posts */}
            {isLoadingMembers ? (
              <CommunityLoadingState />
            ) : isMember ? (
              <>
                {isErrorPosts && (
                  <Card className="rounded-lg border-red-200 bg-red-50">
                    <CardContent className="py-6 text-center">
                      <Lock className="h-8 w-8 mx-auto mb-2 text-red-600" />
                      <p className="text-sm text-red-600 mb-2">
                        {group.privacy_level === 'private' || group.privacy_level === 'invite_only'
                          ? 'Este grupo é privado. Apenas membros podem visualizar o conteúdo.'
                          : 'Erro ao carregar posts'}
                      </p>
                      {group.privacy_level !== 'private' && group.privacy_level !== 'invite_only' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => refetchPosts()}
                      >
                        Tentar novamente
                      </Button>
                      )}
                    </CardContent>
                  </Card>
                )}
                {!isErrorPosts && isLoadingPosts ? (
                  <CommunityLoadingState />
                ) : !isErrorPosts && posts.length > 0 ? (
                  posts.map((post: any) => (
                    <PostCard
                      key={post.id}
                      post={post}
                      groupId={group.id}
                      authorName={post.author_name}
                      authorAvatar={post.author_avatar}
                      onCommentAdded={() => refetchPosts()}
                    />
                  ))
                ) : !isErrorPosts ? (
                  <Card className="rounded-lg">
                    <CardContent className="py-12 text-center">
                      <p className="text-muted-foreground">
                        Nenhum post ainda. Seja o primeiro a compartilhar!
                      </p>
                    </CardContent>
                  </Card>
                ) : null}
              </>
            ) : (
              <Card className="rounded-lg">
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">
                    {group.privacy_level === 'public'
                      ? 'Solicite entrada na barra lateral para ver os posts e participar do grupo.'
                      : 'Este grupo é privado. Solicite entrada na barra lateral para participar.'}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar Direita - Cards do Criador e Integrantes */}
          <div className="lg:col-span-3 space-y-4">
            <GroupMembersColumn
              groupId={group.id}
              createdBy={group.created_by}
              members={members}
              isLoading={isLoadingMembers}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

