
import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { AuthContainer } from '@/components/Auth/AuthContainer';

const Auth: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();

  // CRÍTICO: Verificar URL e hash ANTES de qualquer outra verificação
  // Isso previne redirecionamento durante recovery
  useEffect(() => {
    // Verificar se há token de recovery na URL (hash ou query params)
    const hash = window.location.hash.substring(1);
    const hashParams = new URLSearchParams(hash);
    const searchParams = new URLSearchParams(location.search);
    
    const type = hashParams.get('type') || searchParams.get('type');
    const hasAccessToken = hash.includes('access_token') || hashParams.has('access_token');
    
    // Se detectar recovery na URL, setar flag IMEDIATAMENTE
    if (location.pathname === '/auth/reset-password' || 
        type === 'recovery' || 
        hasAccessToken) {
      localStorage.setItem('is_password_recovery', 'true');
    }
  }, [location]);

  // Se estiver na página de reset de senha, não redirecionar mesmo com usuário logado
  if (location.pathname === '/auth/reset-password') {
    return <AuthContainer />;
  }

  // Se for recovery, não redirecionar
  const isRecovery = localStorage.getItem('is_password_recovery') === 'true';
  if (isRecovery) {
    return <AuthContainer />;
  }

  // If already logged in, redirect to home (exceto se for recovery)
  if (user) {
    return <Navigate to="/" />;
  }

  return <AuthContainer />;
};

export default Auth;
