import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { showErrorToast, showSuccessToast } from '@/integrations/supabase/toast-utils';
import { logError, logSecurity } from '@/utils/secureLogger';

type SocialProvider = 'google' | 'github';

export const useSocialAuth = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProvider, setLoadingProvider] = useState<SocialProvider | null>(null);

  const signInWithProvider = useCallback(async (provider: SocialProvider) => {
    setIsLoading(true);
    setLoadingProvider(provider);

    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) {
        logError(`Social auth failed (${provider})`, { error: error.message }, 'AUTH');
        logSecurity(`Social auth attempt failed`, { provider }, 'AUTH');
        
        // Verificar se o erro é de provedor não habilitado
        if (error.message?.includes('not enabled') || 
            error.message?.includes('Unsupported provider') ||
            error.message?.includes('validation_failed')) {
          showErrorToast(
            'Provedor não configurado',
            `A autenticação via ${provider} não está disponível no momento. Por favor, use email e senha para fazer login.`
          );
        } else {
          showErrorToast('Erro ao autenticar', `Não foi possível autenticar com ${provider}. Tente novamente.`);
        }
        return false;
      }

      // O redirecionamento será feito automaticamente pelo Supabase
      logSecurity(`Social auth initiated`, { provider }, 'AUTH');
      return true;
    } catch (error: any) {
      logError(`Social auth error (${provider})`, { error: error.message }, 'AUTH');
      showErrorToast('Erro interno', 'Ocorreu um erro ao processar sua solicitação. Tente novamente.');
      return false;
    } finally {
      setIsLoading(false);
      setLoadingProvider(null);
    }
  }, []);

  return {
    isLoading,
    loadingProvider,
    signInWithProvider,
  };
};

