import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Trash2, UserMinus, FileText, Users, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { studyGroupService } from '../../services/studyGroupService';
import { studyGroupPostsService } from '../../services/studyGroupPostsService';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { StudyGroup, GroupMember, GroupPost } from '../../domain/types';
import { useGroupFeed } from '../../hooks/useGroupPosts';
import { useGroupMembers } from '../../hooks/useGroupMembers';
import { getAvatarUrl } from '@/utils/avatarUtils';
import { useInviteUser } from '../../hooks/useGroupRequests';
import { useAuth } from '@/hooks/useAuth';

interface GroupSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: StudyGroup;
  onGroupUpdated?: () => void;
}

export const GroupSettingsModal: React.FC<GroupSettingsModalProps> = ({
  open,
  onOpenChange,
  group,
  onGroupUpdated,
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'general' | 'members' | 'posts' | 'danger'>('general');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  
  // Form states
  const [name, setName] = useState(group.name);
  const [description, setDescription] = useState(group.description || '');
  const [maxMembers, setMaxMembers] = useState(group.max_members.toString());
  const [privacyLevel, setPrivacyLevel] = useState<'public' | 'private'>(group.privacy_level as 'public' | 'private');
  const [allowMemberPosts, setAllowMemberPosts] = useState(
    (group.group_settings as any)?.allow_member_posts !== false
  );

  // Posts e membros
  const { posts, refetch: refetchPosts } = useGroupFeed(group.id);
  const { members, refetch: refetchMembers } = useGroupMembers(group.id);
  const inviteUser = useInviteUser();
  const { user: authUser } = useAuth();

  const handleSaveGeneral = async () => {
    setIsSaving(true);
    try {
      await studyGroupService.updateGroup(group.id, {
        name,
        description: description || undefined,
        max_members: parseInt(maxMembers, 10),
        privacy_level: privacyLevel,
        group_settings: {
          ...(group.group_settings as any || {}),
          allow_member_posts: allowMemberPosts,
        },
      });

      toast({
        title: 'Configurações salvas',
        description: 'As configurações do grupo foram atualizadas.',
      });

      queryClient.invalidateQueries({ queryKey: ['study-group', group.id] });
      onGroupUpdated?.();
    } catch (error: any) {
      toast({
        title: 'Erro ao salvar',
        description: error.message || 'Não foi possível salvar as configurações.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    if (!confirm(`Tem certeza que deseja remover ${memberName} do grupo?`)) {
      return;
    }

    try {
      const { data, error } = await supabase.rpc('remove_group_member', {
        p_group_id: group.id,
        p_member_id: memberId,
        p_admin_id: authUser?.id,
      });

      if (error) throw error;

      if (data && !(data as any).success) {
        throw new Error((data as any).error || 'Erro ao remover membro');
      }

      toast({
        title: 'Membro removido',
        description: `${memberName} foi removido do grupo.`,
      });

      refetchMembers();
      queryClient.invalidateQueries({ queryKey: ['group-members', group.id] });
    } catch (error: any) {
      toast({
        title: 'Erro ao remover membro',
        description: error.message || 'Não foi possível remover o membro.',
        variant: 'destructive',
      });
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!confirm('Tem certeza que deseja excluir este post?')) {
      return;
    }

    try {
      const { data, error } = await supabase.rpc('delete_group_post', {
        p_group_id: group.id,
        p_post_id: postId,
      });

      if (error) throw error;

      // Verificar se a função retornou sucesso
      if (data && !(data as any).success) {
        const errorMsg = (data as any).error || 'Erro desconhecido ao excluir post';
        throw new Error(errorMsg);
      }

      toast({
        title: 'Post excluído',
        description: 'O post foi excluído com sucesso.',
      });

      refetchPosts();
      queryClient.invalidateQueries({ queryKey: ['group-feed', group.id] });
    } catch (error: any) {
      toast({
        title: 'Erro ao excluir post',
        description: error.message || 'Não foi possível excluir o post.',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteGroup = async () => {
    if (deleteConfirmText !== 'Excluir') {
      toast({
        title: 'Confirmação inválida',
        description: 'Digite "Excluir" para confirmar a exclusão.',
        variant: 'destructive',
      });
      return;
    }

    setIsDeleting(true);
    try {
      const { error } = await supabase.rpc('delete_study_group', {
        p_group_id: group.id,
      });

      if (error) throw error;

      toast({
        title: 'Grupo excluído',
        description: 'O grupo foi excluído com sucesso.',
      });

      queryClient.invalidateQueries({ queryKey: ['study-groups'] });
      onOpenChange(false);
      window.location.href = '/comunidade';
    } catch (error: any) {
      toast({
        title: 'Erro ao excluir grupo',
        description: error.message || 'Não foi possível excluir o grupo.',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleInviteUser = async (emailOrId: string) => {
    if (!emailOrId.trim()) {
      toast({
        title: 'Campo vazio',
        description: 'Digite um email ou ID do usuário.',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Buscar usuário por email ou ID
      let userId = emailOrId.trim();
      
      // Se parece email, buscar ID
      if (emailOrId.includes('@')) {
        const { data: userData, error: userError } = await supabase
          .from('users_profiles')
          .select('id')
          .eq('email', emailOrId.trim())
          .single();
        
        if (userError || !userData) {
          toast({
            title: 'Usuário não encontrado',
            description: 'Não foi possível encontrar o usuário com este email.',
            variant: 'destructive',
          });
          return;
        }
        userId = userData.id;
      }

      await inviteUser.mutateAsync({
        groupId: group.id,
        userId,
      });

      refetchMembers();
    } catch (error: any) {
      // O toast já é exibido pelo hook - erro silencioso
    }
  };

  const isCreator = group.created_by === authUser?.id;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configurações do Grupo</DialogTitle>
          <DialogDescription>
            Gerencie as configurações, membros e posts do grupo.
          </DialogDescription>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex gap-2 border-b mb-4">
          <Button
            variant={activeTab === 'general' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('general')}
          >
            Geral
          </Button>
          <Button
            variant={activeTab === 'members' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('members')}
          >
            Membros
          </Button>
          <Button
            variant={activeTab === 'posts' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('posts')}
          >
            Posts
          </Button>
          <Button
            variant={activeTab === 'danger' ? 'destructive' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('danger')}
          >
            Perigo
          </Button>
        </div>

        {/* Tab: Geral */}
        {activeTab === 'general' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome do Grupo</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={20}
              />
              <p className="text-xs text-muted-foreground">
                {name.length}/20 caracteres
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Sobre o Grupo</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                maxLength={1000}
              />
              <p className="text-xs text-muted-foreground">
                {description.length}/1000 caracteres
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="maxMembers">Número Máximo de Membros</Label>
                <Input
                  id="maxMembers"
                  type="number"
                  value={maxMembers}
                  onChange={(e) => {
                    const value = e.target.value;
                    const numValue = parseInt(value, 10);
                    if (!isNaN(numValue) && numValue >= 1 && numValue <= 1000) {
                      setMaxMembers(value);
                    } else if (value === '' || value === '0') {
                      setMaxMembers('1'); // Mínimo 1
                    }
                  }}
                  min={1}
                  max={1000}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="privacy">Visibilidade</Label>
                <Select value={privacyLevel} onValueChange={(v) => setPrivacyLevel(v as 'public' | 'private')}>
                  <SelectTrigger id="privacy">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Público</SelectItem>
                    <SelectItem value="private">Privado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-0.5">
                <Label htmlFor="allowPosts">Permitir posts de membros</Label>
                <p className="text-sm text-muted-foreground">
                  Se desativado, apenas administradores podem criar posts.
                </p>
              </div>
              <Switch
                id="allowPosts"
                checked={allowMemberPosts}
                onCheckedChange={setAllowMemberPosts}
              />
            </div>

            <Button onClick={handleSaveGeneral} disabled={isSaving} className="w-full">
              {isSaving ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </div>
        )}

        {/* Tab: Membros */}
        {activeTab === 'members' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Membros do Grupo ({members.length})</h3>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {members.map((member) => {
                const getInitials = (name?: string) => {
                  if (!name) return 'U';
                  return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
                };
                
                return (
                <div
                  key={member.id || member.user_id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={getAvatarUrl(member.avatar_url)} alt={member.name} />
                      <AvatarFallback className="bg-muted">
                        {getInitials(member.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{member.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {member.role === 'admin' ? 'Administrador' : 'Membro'}
                        {member.user_id === group.created_by && ' (Criador)'}
                      </p>
                    </div>
                  </div>
                  {(member.user_id !== group.created_by && member.role !== 'admin') && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveMember(member.id || member.user_id!, member.name)}
                    >
                      <UserMinus className="h-4 w-4 mr-2" />
                      Remover
                    </Button>
                  )}
                </div>
                );
              })}
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="inviteEmail">Convidar Participante</Label>
              <div className="flex gap-2">
                <Input
                  id="inviteEmail"
                  placeholder="Email ou ID do usuário"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleInviteUser(e.currentTarget.value);
                    }
                  }}
                />
                <Button
                  onClick={() => {
                    const input = document.getElementById('inviteEmail') as HTMLInputElement;
                    if (input.value) {
                      handleInviteUser(input.value);
                      input.value = '';
                    }
                  }}
                  disabled={inviteUser.isPending}
                >
                  <Users className="h-4 w-4 mr-2" />
                  Convidar
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Tab: Posts */}
        {activeTab === 'posts' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Posts do Grupo ({posts.length})</h3>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {posts.map((post: any) => (
                <div
                  key={post.id}
                  className="flex items-start justify-between p-3 border rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{post.author_name || 'Usuário'}</p>
                    <p className="text-sm text-muted-foreground break-words line-clamp-2">
                      {post.content}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(post.created_at).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeletePost(post.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
              {posts.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum post encontrado.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Tab: Perigo */}
        {activeTab === 'danger' && (
          <div className="space-y-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Esta ação não pode ser desfeita. O grupo e todos os seus dados serão permanentemente excluídos.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="deleteConfirm">
                Digite "Excluir" para confirmar
              </Label>
              <Input
                id="deleteConfirm"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="Excluir"
              />
            </div>

            <Button
              variant="destructive"
              onClick={handleDeleteGroup}
              disabled={isDeleting || deleteConfirmText !== 'Excluir'}
              className="w-full"
            >
              {isDeleting ? 'Excluindo...' : 'Excluir Grupo Permanentemente'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
