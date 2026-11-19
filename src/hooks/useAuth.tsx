
import React, { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { onlineStatusService } from '@/services/onlineStatusService';
import { TokenCleanupService } from '@/services/tokenCleanupService';
import { logError } from '@/utils/secureLogger';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  isLoading: true,
  signOut: async () => {},
  refreshSession: async () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshSession = async () => {
    try {
      const { data: { session: newSession }, error } = await supabase.auth.getSession();
      if (error) {
        logError('Session refresh error', error, 'AUTH');
        // Clear potentially corrupted session
        setSession(null);
        setUser(null);
        return;
      }
      // Debug logs removed for security
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user?.id) {
        void onlineStatusService.setUserOnline(newSession.user.id);
      }
    } catch (error) {
      logError('Failed to refresh session', error, 'AUTH');
      setSession(null);
      setUser(null);
    }
  };

  useEffect(() => {
    let mounted = true;

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (!mounted) return;

        // Log removido por segurança
        
        // CRÍTICO: Verificar URL antes de processar eventos
        // Isso previne race condition durante recovery
        const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
        const hash = typeof window !== 'undefined' ? window.location.hash.substring(1) : '';
        const hashParams = new URLSearchParams(hash);
        const urlType = hashParams.get('type');
        const hasAccessToken = hash.includes('access_token');
        const isResetPasswordPage = currentPath === '/auth/reset-password';
        
        // Se detectar recovery na URL, setar flag IMEDIATAMENTE
        if (isResetPasswordPage || urlType === 'recovery' || hasAccessToken) {
          localStorage.setItem('is_password_recovery', 'true');
        }

        // Handle different auth events
        switch (event) {
          case 'PASSWORD_RECOVERY':
            // Recovery de senha - não redirecionar, deixar a página de reset lidar
            setSession(newSession);
            setUser(newSession?.user ?? null);
            setIsLoading(false);
            // Marcar como recovery para evitar redirecionamento
            localStorage.setItem('is_password_recovery', 'true');
            // Não marcar como online durante recovery
            break;
          case 'SIGNED_IN':
            setSession(newSession);
            setUser(newSession?.user ?? null);
            setIsLoading(false);
            
            // Verificar se é recovery de múltiplas formas
            const isRecovery = localStorage.getItem('is_password_recovery') === 'true' ||
                              isResetPasswordPage ||
                              urlType === 'recovery' ||
                              hasAccessToken;
            
            // Se for recovery, não fazer nada além de setar a sessão
            if (isRecovery) {
              // Garantir que a flag está setada
              localStorage.setItem('is_password_recovery', 'true');
              // Não marcar como online durante recovery
              break;
            }
            
            // Apenas marcar como online se NÃO for recovery
            if (newSession?.user?.id) {
              onlineStatusService.setUserOnline(newSession.user.id);
            }
            break;
          case 'SIGNED_OUT':
            setSession(null);
            setUser(null);
            setIsLoading(false);
            // Marcar usuário como offline
            if (user?.id) {
              onlineStatusService.setUserOffline(user.id);
            }
            // Clear any cached data
            localStorage.removeItem('auth_lockout_end');
            break;
          case 'TOKEN_REFRESHED':
            setSession(newSession);
            setUser(newSession?.user ?? null);
            break;
          case 'USER_UPDATED':
            setSession(newSession);
            setUser(newSession?.user ?? null);
            break;
          default:
            setSession(newSession);
            setUser(newSession?.user ?? null);
            setIsLoading(false);
        }
      }
    );

    // Initial session check
    refreshSession().finally(() => {
      if (mounted) {
        setIsLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
      // Cleanup online status quando o componente for desmontado
      onlineStatusService.cleanup();
    };
  }, []);

  const signOut = async () => {
    try {
      setIsLoading(true);
      
      // Marcar usuário como offline antes de fazer logout
      if (user?.id) {
        await onlineStatusService.setUserOffline(user.id);
      }
      
      const { error } = await supabase.auth.signOut();
      if (error) {
        logError('Sign out error', error, 'AUTH');
        throw error;
      }
      
      // Clear local state
      setUser(null);
      setSession(null);
      
      // Clear all obfuscation tokens
      TokenCleanupService.clearAllTokens();
      
      // Clear any cached authentication data
      localStorage.removeItem('auth_lockout_end');
      
    } catch (error) {
      logError('Error signing out', error, 'AUTH');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, isLoading, signOut, refreshSession }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
