import React, { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Search, UserCheck, BookOpen, UserCircle, GraduationCap } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { usePresence } from '@/contexts/PresenceContext';
import { useSecureUserUrls } from '@/services/userUrlObfuscation';
import { useToast } from '@/hooks/use-toast';
import { devLog } from '@/utils/productionLogger';
import { CommunityEmptyState } from '../components/shared/CommunityEmptyState';
import { CommunityErrorState } from '../components/shared/CommunityErrorState';
import { CommunityLoadingState } from '../components/shared/CommunityLoadingState';
import { GroupsTab } from '../components/groups/GroupsTab';
import { UserGrid } from '../components/users/UserGrid';
import { sortCommunityUsers } from '../domain/communityUserSort';
import { useCommunityUsers } from '../hooks/useCommunityUsers';

const CommunityPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { generateSecureUserUrl } = useSecureUserUrls();
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleUsers, setVisibleUsers] = useState(12);
  const { users, isLoading, isError } = useCommunityUsers(searchQuery);
  const { isOnline } = usePresence();

  const sortedUsers = useMemo(
    () => sortCommunityUsers(users, isOnline),
    [users, isOnline]
  );

  const displayedUsers = sortedUsers.slice(0, visibleUsers);
  const hasMoreUsers = sortedUsers.length > visibleUsers;

  useEffect(() => {
    setVisibleUsers(12);
  }, [searchQuery]);

  const loadMoreUsers = () => {
    setVisibleUsers((prev) => prev + 12);
  };

  const handleUserClick = async (userId: string) => {
    if (!user) {
      navigate('/auth', { state: { from: '/comunidade' } });
      return;
    }

    try {
      const secureUrl = await generateSecureUserUrl(userId, 'profile');
      navigate(secureUrl);
    } catch (error: unknown) {
      devLog.error('Erro ao gerar URL segura de usuário:', error);
      if (import.meta.env.PROD && error instanceof Error && error.message.includes('não configurada')) {
        toast({
          title: 'Erro de configuração',
          description: 'O sistema não está configurado corretamente. Entre em contato com o suporte.',
          variant: 'destructive',
        });
        return;
      }
      navigate('/comunidade');
    }
  };

  if (isLoading) return <CommunityLoadingState />;
  if (isError) return <CommunityErrorState />;

  return (
    <div className="min-h-screen bg-page-background">
      <div className="page-content-container">
        <Tabs defaultValue="usuarios" className="space-y-6">
          <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
            <div className="hidden md:grid grid-cols-3 gap-2" style={{ width: '48%' }}>
              <Card className="shadow-lg hover:shadow-xl transition-all duration-300 h-13 flex flex-col justify-center">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0 px-3">
                  <CardTitle className="text-sm font-semibold">Total</CardTitle>
                  <UserCircle className="h-4 w-4" />
                </CardHeader>
                <CardContent className="pt-0 text-left px-3">
                  <div className="text-xl font-black">{users.length}</div>
                </CardContent>
              </Card>

              <Card className="shadow-lg hover:shadow-xl transition-all duration-300 h-13 flex flex-col justify-center">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0 px-3">
                  <CardTitle className="text-sm font-semibold">Online</CardTitle>
                  <UserCheck className="h-4 w-4" />
                </CardHeader>
                <CardContent className="pt-0 text-left px-3">
                  <div className="text-xl font-black">{users.filter((u) => isOnline(u.id)).length}</div>
                </CardContent>
              </Card>

              <Card className="shadow-lg hover:shadow-xl transition-all duration-300 h-13 flex flex-col justify-center">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0 px-3">
                  <CardTitle className="text-sm font-semibold">Estudando</CardTitle>
                  <GraduationCap className="h-4 w-4" />
                </CardHeader>
                <CardContent className="pt-0 text-left px-3">
                  <div className="text-xl font-black">{users.filter((u) => u.is_studying).length}</div>
                </CardContent>
              </Card>
            </div>

            <div className="relative max-w-md w-full md:w-auto">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Buscar usuários por nome..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <TabsList>
            <TabsTrigger value="usuarios">
              <Users className="mr-2 h-4 w-4" />
              Concurseiros
            </TabsTrigger>
            <TabsTrigger value="grupos">
              <BookOpen className="mr-2 h-4 w-4" />
              Grupos de Estudos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="usuarios">
            <div className="mb-8">
              {displayedUsers.length > 0 ? (
                <>
                  <UserGrid users={displayedUsers} onClick={handleUserClick} />
                  {hasMoreUsers && (
                    <div className="flex justify-center mt-6">
                      <Button onClick={loadMoreUsers} variant="outline" className="px-8 py-2">
                        Carregar mais
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <CommunityEmptyState />
              )}
            </div>
          </TabsContent>

          <TabsContent value="grupos">
            <GroupsTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default CommunityPage;
