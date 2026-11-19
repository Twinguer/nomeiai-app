import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { showErrorToast, showSuccessToast } from '@/integrations/supabase/toast-utils';
import { RateLimiters } from '@/utils/rateLimiter';
import { logError, logSecurity } from '@/utils/secureLogger';
import DOMPurify from 'dompurify';

export const usePasswordReset = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  // Sanitize user input
  const sanitizeInput = useCallback((input: string): string => {
    return DOMPurify.sanitize(input.trim());
  }, []);

  // Enhanced email validation
  const isEmailValid = useCallback((email: string): boolean => {
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    return emailRegex.test(email) && email.length <= 254;
  }, []);

  // Request password reset
  const requestPasswordReset = useCallback(async (email: string) => {
    const sanitizedEmail = sanitizeInput(email);

    if (!isEmailValid(sanitizedEmail)) {
      showErrorToast('Email inválido', 'Por favor, forneça um email válido.');
      return false;
    }

    // Check rate limiting for password reset
    const rateLimitResult = RateLimiters.passwordReset.check(sanitizedEmail, false);
    if (!rateLimitResult.allowed) {
      const retryAfter = Math.ceil((rateLimitResult.retryAfter || 3600) / 60);
      showErrorToast(
        'Limite de tentativas excedido',
        `Você já solicitou a recuperação de senha recentemente. Tente novamente em ${retryAfter} minutos.`
      );
      return false;
    }

    setIsLoading(true);

    try {
      // Garantir que a URL seja absoluta e completa
      const redirectUrl = window.location.origin.startsWith('http')
        ? `${window.location.origin}/auth/reset-password`
        : `https://${window.location.hostname}/auth/reset-password`;
      
      const { error } = await supabase.auth.resetPasswordForEmail(sanitizedEmail, {
        redirectTo: redirectUrl,
      });

      if (error) {
        // Não revelar se o email existe ou não por segurança
        logError('Password reset request failed', { error: error.message }, 'AUTH');
        logSecurity('Password reset attempt', { email: sanitizedEmail }, 'AUTH');
        
        // Mostrar mensagem genérica mesmo em caso de erro
        showSuccessToast(
          'Email enviado',
          'Se o email estiver cadastrado, você receberá um link para redefinir sua senha. Verifique sua caixa de entrada e spam.'
        );
        return true; // Retornar true para não revelar se o email existe
      }

      // Registrar tentativa bem-sucedida
      RateLimiters.passwordReset.check(sanitizedEmail, true);
      
      showSuccessToast(
        'Email enviado',
        'Se o email estiver cadastrado, você receberá um link para redefinir sua senha. Verifique sua caixa de entrada e spam.'
      );
      
      logSecurity('Password reset email sent', { email: sanitizedEmail }, 'AUTH');
      return true;
    } catch (error: any) {
      logError('Password reset request error', { error: error.message }, 'AUTH');
      showErrorToast('Erro interno', 'Ocorreu um erro ao processar sua solicitação. Tente novamente.');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [sanitizeInput, isEmailValid]);

  // Verify current password (for logged-in users)
  const verifyCurrentPassword = useCallback(async (currentPassword: string, userEmail: string): Promise<boolean> => {
    if (!currentPassword || !userEmail) {
      return false;
    }

    try {
      // Try to sign in with current password to verify it
      // This will create a new session, which is fine since we're about to update the password
      const { error } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password: currentPassword,
      });

      if (error) {
        logError('Current password verification failed', { error: error.message }, 'AUTH');
        return false;
      }

      return true;
    } catch (error: any) {
      logError('Current password verification error', { error: error.message }, 'AUTH');
      return false;
    }
  }, []);

  // Reset password with token or change password for logged-in user
  const resetPassword = useCallback(async (newPassword: string, currentPassword?: string, userEmail?: string, isLoggedInUser?: boolean) => {
    if (!newPassword || newPassword.length < 8) {
      showErrorToast('Senha inválida', 'A senha deve ter pelo menos 8 caracteres.');
      return false;
    }

    // If user is logged in, verify current password first
    if (isLoggedInUser && currentPassword && userEmail) {
      const isValid = await verifyCurrentPassword(currentPassword, userEmail);
      if (!isValid) {
        showErrorToast('Senha atual incorreta', 'A senha atual informada está incorreta. Tente novamente.');
        return false;
      }
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        logError('Password reset failed', { error: error.message }, 'AUTH');
        
        if (error.message?.includes('token') || error.message?.includes('expired')) {
          showErrorToast('Link expirado', 'O link de recuperação expirou. Solicite um novo link.');
          navigate('/auth/forgot-password');
        } else {
          showErrorToast('Erro ao redefinir senha', 'Não foi possível redefinir sua senha. Tente novamente.');
        }
        return false;
      }

      // Limpar flag de recovery
      localStorage.removeItem('is_password_recovery');
      
      if (isLoggedInUser) {
        // Usuário logado - não fazer logout, apenas mostrar sucesso
        showSuccessToast('Senha alterada', 'Sua senha foi alterada com sucesso!');
        logSecurity('Password changed successfully', {}, 'AUTH');
        return true;
      } else {
        // Recovery flow - fazer logout e redirecionar
        showSuccessToast('Senha redefinida', 'Sua senha foi redefinida com sucesso! Redirecionando para o login...');
        logSecurity('Password reset successful', {}, 'AUTH');
        
        // Fazer logout para garantir que o usuário faça login com a nova senha
        await supabase.auth.signOut();
        
        // Redirecionar para login após 2 segundos
        setTimeout(() => {
          navigate('/auth');
        }, 2000);
      }
      
      return true;
    } catch (error: any) {
      logError('Password reset error', { error: error.message }, 'AUTH');
      showErrorToast('Erro interno', 'Ocorreu um erro ao processar sua solicitação. Tente novamente.');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [navigate, verifyCurrentPassword]);

  return {
    isLoading,
    requestPasswordReset,
    resetPassword,
    verifyCurrentPassword,
  };
};

