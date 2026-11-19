
import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { useQuery } from '@tanstack/react-query';
import { showProRequiredToast } from '@/utils/planRestrictions';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Users, UserPlus, User, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useSecureUserUrls } from '@/services/userUrlObfuscation';
import { devLog, sanitizeForLog } from '@/utils/productionLogger';
import { getAvatarUrl } from '@/utils/avatarUtils';

interface FollowerUser {
  id: string;
  name: string;
  avatar_url: string | null;
  bio: string | null;
  email: string;
  isFollowing?: boolean;
}

const UserFollowers = () => {
  const { user } = useAuth();
  const { isPro } = useSubscription();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { generateSecureUserUrl } = useSecureUserUrls();
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({});
  
  // Determine whose lists to show: route param or current user
  const { id: routeUserId } = useParams<{ id: string }>();
  const targetUserId = routeUserId || user?.id || '';

  // Fetch followers for target user via RPC (security definer)
  const { data: followers, isLoading: isLoadingFollowers } = useQuery({
    queryKey: ['user-followers', targetUserId],
    queryFn: async () => {
      if (!targetUserId) return [];

      const { data, error } = await supabase.rpc('get_followers_list', { target_user_id: targetUserId });
      if (error) {
        devLog.error('Error fetching followers:', error);
        return [];
      }

      // If logged in, fetch who current user follows to mark buttons
      if (user) {
        const { data: userFollowing, error: followingError } = await supabase
          .from('user_followers')
          .select('followed_id')
          .eq('follower_id', user.id);
        if (!followingError) {
          const followMap: Record<string, boolean> = {};
          userFollowing?.forEach(f => { followMap[f.followed_id] = true; });
          setFollowingMap(followMap);
        }
      }

      return (data || []).map((profile: any) => ({
        ...profile,
        isFollowing: !!followingMap[profile.id],
        bio: null,
        email: ''
      }));
    },
    enabled: !!targetUserId
  });

  // Fetch following for target user via RPC (security definer)
  const { data: following, isLoading: isLoadingFollowing } = useQuery({
    queryKey: ['user-following', targetUserId],
    queryFn: async () => {
      if (!targetUserId) return [];

      const { data, error } = await supabase.rpc('get_following_list', { target_user_id: targetUserId });
      if (error) {
        devLog.error('Error fetching following:', error);
        return [];
      }

      if (user) {
        const newFollowingMap = { ...followingMap };
        data?.forEach((profile: any) => { newFollowingMap[profile.id] = true; });
        setFollowingMap(newFollowingMap);
      }

      return (data || []).map((profile: any) => ({
        ...profile,
        isFollowing: true,
        bio: null,
        email: ''
      }));
    },
    enabled: !!targetUserId
  });
  
  const toggleFollow = async (userId: string) => {
    if (!user) {
      toast({
        title: "Ação necessária",
        description: "Você precisa estar conectado para seguir outros usuários.",
        variant: "destructive"
      });
      return;
    }
    
    if (user.id === userId) {
      toast({
        title: "Aviso",
        description: "Você não pode seguir a si mesmo.",
        variant: "destructive"
      });
      return;
    }
    
    try {
      if (followingMap[userId]) {
        // Unfollow
        const { error } = await supabase
          .from('user_followers')
          .delete()
          .eq('follower_id', user.id)
          .eq('followed_id', userId);
          
        if (error) throw error;
        
        setFollowingMap(prev => {
          const updated = { ...prev };
          updated[userId] = false;
          return updated;
        });
        
        toast({
          title: "Sucesso",
          description: "Você deixou de seguir este usuário."
        });
      } else {
        // Follow
        const { error } = await supabase
          .from('user_followers')
          .insert({ follower_id: user.id, followed_id: userId });
          
        if (error) throw error;
        
        setFollowingMap(prev => {
          const updated = { ...prev };
          updated[userId] = true;
          return updated;
        });
        
        toast({
          title: "Sucesso",
          description: "Você começou a seguir este usuário."
        });
      }
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Ocorreu um erro ao tentar seguir este usuário.",
        variant: "destructive"
      });
    }
  };
  
  // Generate initials for avatar
  const getInitials = (name: string) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  };

  // Handle view profile navigation
  const handleViewProfile = async (userId: string) => {
    // Verificar se é perfil de outro usuário e se o usuário atual é Free
    const isOtherUserProfile = user && userId !== user.id;
    if (isOtherUserProfile && !isPro) {
      showProRequiredToast(navigate, 'Visualizar Perfis de Outros Usuários');
      return;
    }

    try {
      const secureUrl = await generateSecureUserUrl(userId, 'profile');
      navigate(secureUrl);
    } catch (error) {
      devLog.error('Erro ao gerar URL segura de usuário:', error);
      // ✅ SEGURANÇA: Nunca usar fallback com UUID direto
      // Redirecionar para comunidade (não expor UUID)
      navigate('/comunidade');
    }
  };
  
  const renderUserList = (users: FollowerUser[] | undefined, isLoading: boolean, emptyMessage: string) => {
    if (isLoading) {
      return (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      );
    }
    
    if (!users || users.length === 0) {
      return (
        <div className="text-center py-12">
          <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">{emptyMessage}</p>
        </div>
      );
    }
    
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {users.map(userProfile => (
          <Card key={userProfile.id} className="overflow-hidden">
            <div className="p-4 flex space-x-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={getAvatarUrl(userProfile.avatar_url)} alt={userProfile.name} />
                <AvatarFallback className="text-lg">{getInitials(userProfile.name)}</AvatarFallback>
              </Avatar>
              
              <div className="flex-1">
                <h3 className="font-medium">{userProfile.name}</h3>
                <p className="text-sm text-muted-foreground line-clamp-2">{userProfile.bio || 'Sem biografia'}</p>
                
                <div className="mt-3 flex space-x-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handleViewProfile(userProfile.id)}
                  >
                    Ver perfil
                  </Button>

                  <Button 
                    size="sm" 
                    className="px-3"
                    variant={followingMap[userProfile.id] ? "default" : "outline"}
                    onClick={() => toggleFollow(userProfile.id)}
                    disabled={user.id === userProfile.id}
                  >
                    {user.id === userProfile.id ? (
                      <>
                        <User className="h-4 w-4 mr-2" />
                        Seu perfil
                      </>
                    ) : followingMap[userProfile.id] ? (
                      <>
                        <UserPlus className="h-4 w-4 mr-2" />
                        Seguindo
                      </>
                    ) : (
                      <>
                        <UserPlus className="h-4 w-4 mr-2" />
                        Seguir
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    );
  };
  
  return (
    <div className="container mx-auto p-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Rede de Contatos</h1>
      
      <Tabs defaultValue="followers">
        <TabsList className="w-full max-w-md mx-auto grid grid-cols-2 mb-6">
          <TabsTrigger value="followers">
            <Users className="h-4 w-4 mr-2" />
            Seguidores ({followers?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="following">
            <UserPlus className="h-4 w-4 mr-2" />
            Seguindo ({following?.length || 0})
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="followers">
          <Card>
            <CardHeader>
              <CardTitle>Meus Seguidores</CardTitle>
              <CardDescription>
                Pessoas que seguem sua atividade e resultados em concursos
              </CardDescription>
            </CardHeader>
            <CardContent>
              {renderUserList(
                followers, 
                isLoadingFollowers, 
                "Você ainda não tem seguidores. Compartilhe seu perfil para aumentar sua rede!"
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="following">
          <Card>
            <CardHeader>
              <CardTitle>Pessoas que você segue</CardTitle>
              <CardDescription>
                Candidatos e profissionais que você acompanha
              </CardDescription>
            </CardHeader>
            <CardContent>
              {renderUserList(
                following, 
                isLoadingFollowing, 
                "Você ainda não está seguindo ninguém. Encontre outros candidatos para ampliar sua rede!"
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      <div className="mt-8 text-center">
        <Button onClick={() => navigate('/perfil')}>
          Voltar ao perfil
        </Button>
      </div>
    </div>
  );
};

export default UserFollowers;
