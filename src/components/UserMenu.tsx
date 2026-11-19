import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuLabel } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { User, LogOut, Users, Clock, Moon, Sun, Bell, Lock, ShieldAlert, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useOpenAdminPanel } from '@/hooks/useOpenAdminPanel';
import { useTimer } from '@/contexts/TimerContext';
import { useToast } from '@/components/ui/use-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTheme as useDarkTheme } from 'next-themes';
import { useNotifications } from '@/hooks/useNotifications';
import { UserAvatar } from '@/components/profile/UserAvatar';

const UserMenu: React.FC = () => {
  const { user, signOut } = useAuth();
  const { isStudying, minutes, seconds, isRunning, isPaused } = useTimer();
  const { theme: darkTheme, setTheme: setDarkTheme } = useDarkTheme();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { unreadCount } = useNotifications();
  const { openAdminPanel, isOpening: isOpeningAdminPanel, canOpenAdminPanel } = useOpenAdminPanel();

  const toggleDarkMode = () => {
    setDarkTheme(darkTheme === "dark" ? "light" : "dark");
  };

  const { data: profile } = useQuery({
    queryKey: ['user-profile-menu', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('public_profiles')
        .select('name, avatar_url')
        .eq('id', user.id)
        .single();
      if (error) return null;
      return data;
    },
    enabled: !!user
  });

  const handleSignOut = async () => {
    try {
      await signOut();
      queryClient.clear();
      navigate('/', { replace: true });
    } catch (error) {
      toast({
        title: 'Erro ao desconectar',
        description: 'Ocorreu um erro ao tentar sair. Por favor, tente novamente.',
        variant: 'destructive'
      });
    }
  };


  const formatTime = (mins: number, secs: number) => {
    // Validate and fix NaN values
    const validMins = isNaN(mins) ? 0 : Math.max(0, mins);
    const validSecs = isNaN(secs) ? 0 : Math.max(0, secs);
    return `${validMins.toString().padStart(2, '0')}:${validSecs.toString().padStart(2, '0')}`;
  };


  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => navigate('/auth')}>
          Fazer Login
        </Button>
      </div>
    );
  }

  const userName = profile?.name || user.user_metadata?.name || user.email || 'Usuário';

  return (
    <div className="flex items-center gap-2">
      {isRunning && (
        <Badge 
          variant="secondary" 
          className={`flex items-center gap-1 cursor-pointer hover:opacity-80 transition-colors ${
            isPaused 
              ? 'bg-muted text-muted-foreground border-muted-foreground/20' 
              : 'bg-primary/10 text-primary border-primary/20 hover:bg-primary/20'
          }`}
          onClick={() => navigate('/estudos/timer')}
        >
          <Clock className="h-3 w-3" />
          <span className="font-mono text-xs">{formatTime(minutes, seconds)}</span>
          <span className="text-xs">• {isPaused ? 'Pausado' : 'Estudando'}</span>
        </Badge>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-8 w-8 rounded-full p-0">
            <UserAvatar 
              name={userName}
              avatarUrl={profile?.avatar_url}
              size="sm"
              userId={user?.id}
              showOnlineStatus={true}
            />
            {unreadCount > 0 && (
              <div className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 rounded-full flex items-center justify-center z-20">
                <span className="text-xs text-white font-medium">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              </div>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <div className="flex flex-col space-y-1 p-2">
            <p className="text-sm font-medium leading-none">{userName}</p>
            <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
          </div>
          <DropdownMenuSeparator />
          
          <DropdownMenuItem asChild>
            <Link to="/notificacoes" className="flex w-full cursor-pointer items-center">
              <div className="flex items-center w-full">
                <Bell className="mr-2 h-4 w-4" />
                <span className="flex-1">Notificações</span>
                {unreadCount > 0 && (
                  <Badge variant="destructive" className="text-xs h-5 px-1.5">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </Badge>
                )}
              </div>
            </Link>
          </DropdownMenuItem>
          
          <DropdownMenuItem asChild>
            <Link to="/comunidade" className="flex w-full cursor-pointer items-center">
              <Users className="mr-2 h-4 w-4" />
              <span>Comunidade</span>
            </Link>
          </DropdownMenuItem>
          
          <DropdownMenuItem asChild>
            <Link to="/perfil" className="flex w-full cursor-pointer items-center">
              <User className="mr-2 h-4 w-4" />
              <span>Meu Perfil</span>
            </Link>
          </DropdownMenuItem>

          {canOpenAdminPanel && (
            <DropdownMenuItem
              onClick={openAdminPanel}
              disabled={isOpeningAdminPanel}
              className="cursor-pointer"
            >
              {isOpeningAdminPanel ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ShieldAlert className="mr-2 h-4 w-4" />
              )}
              <span>Painel Admin</span>
            </DropdownMenuItem>
          )}
          
          <DropdownMenuItem asChild>
            <Link to="/auth/reset-password" className="flex w-full cursor-pointer items-center">
              <Lock className="mr-2 h-4 w-4" />
              <span>Trocar Senha</span>
            </Link>
          </DropdownMenuItem>
          
          <DropdownMenuSeparator />
          
          <DropdownMenuLabel>Configurações de Tema</DropdownMenuLabel>
          
          <div className="flex items-center justify-between px-2 py-1.5">
            <span className="text-sm">Modo Escuro</span>
            <Button variant="ghost" size="sm" onClick={toggleDarkMode}>
              <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              <span className="sr-only">Alternar modo escuro</span>
            </Button>
          </div>
          
          <DropdownMenuSeparator />
          
          <DropdownMenuItem onClick={handleSignOut} className="text-destructive cursor-pointer">
            <LogOut className="mr-2 h-4 w-4" />
            <span>Sair</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export default UserMenu;