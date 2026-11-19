import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useLocation, Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-react';
import { usePasswordReset } from '@/hooks/usePasswordReset';
import { PasswordValidator } from '@/utils/passwordValidator';
import { PasswordStrengthIndicator } from '@/components/Auth/PasswordStrengthIndicator';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

const ResetPassword: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { isLoading, resetPassword } = usePasswordReset();
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isValidToken, setIsValidToken] = useState<boolean | null>(null);
  const [isLoggedInUser, setIsLoggedInUser] = useState(false);

  // CRÍTICO: Setar flag IMEDIATAMENTE ao montar o componente
  // Isso previne race condition com Auth.tsx
  useEffect(() => {
    // Verificar URL e setar flag sincronamente
    const hash = window.location.hash.substring(1);
    const hashParams = new URLSearchParams(hash);
    const type = hashParams.get('type') || searchParams.get('type');
    const hasAccessToken = hash.includes('access_token') || hashParams.has('access_token');
    
    // Setar flag imediatamente se detectar recovery
    if (type === 'recovery' || hasAccessToken || location.pathname === '/auth/reset-password') {
      localStorage.setItem('is_password_recovery', 'true');
    }
  }, []); // Executar apenas uma vez ao montar

  useEffect(() => {
    const checkToken = async () => {
      // Obter parâmetros da URL novamente
      const hash = window.location.hash.substring(1);
      const hashParams = new URLSearchParams(hash);
      const type = hashParams.get('type') || searchParams.get('type');
      const hasAccessToken = hash.includes('access_token') || hashParams.has('access_token');
      
      // Verificar se é um recovery (tem token na URL)
      const isRecoveryFlow = type === 'recovery' || hasAccessToken;
      
      // Se for recovery, setar flag
      if (isRecoveryFlow) {
        localStorage.setItem('is_password_recovery', 'true');
      }
      
      // Aguardar um momento para o Supabase processar o hash (se houver)
      if (isRecoveryFlow) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Verificar se há sessão ativa
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        // Se há sessão, permitir troca de senha (tanto recovery quanto usuário logado)
        // Limpar hash da URL se existir
        if (window.location.hash) {
          const cleanUrl = window.location.origin + window.location.pathname;
          window.history.replaceState(null, '', cleanUrl);
        }
        
        // Se não é recovery flow, é um usuário logado que quer trocar a senha
        if (!isRecoveryFlow) {
          setIsLoggedInUser(true);
        }
        
        setIsValidToken(true);
      } else if (isRecoveryFlow) {
        // Se não há sessão mas é recovery, aguardar processamento
        const hasToken = hashParams.get('access_token') || hashParams.get('token') || searchParams.get('token');
        if (hasToken) {
          // Ainda processando
          setIsValidToken(null);
        } else {
          // Aguardar mais um pouco antes de considerar inválido
          await new Promise(resolve => setTimeout(resolve, 1000));
          const { data: { session: retrySession } } = await supabase.auth.getSession();
          if (retrySession) {
            setIsValidToken(true);
          } else {
            setIsValidToken(false);
          }
        }
      } else {
        // Usuário não logado e não é recovery - precisa fazer login primeiro
        setIsValidToken(false);
      }
    };

    checkToken();
  }, [searchParams, location]);

  const validatePassword = (password: string): boolean => {
    const validation = PasswordValidator.validate(password);
    if (!validation.isValid) {
      setErrors(prev => ({
        ...prev,
        password: validation.errors[0] || 'Senha não atende aos requisitos de segurança'
      }));
      return false;
    }
    setErrors(prev => ({ ...prev, password: '' }));
    return true;
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPassword(value);
    if (value) {
      validatePassword(value);
    }
    if (confirmPassword && value !== confirmPassword) {
      setErrors(prev => ({ ...prev, confirmPassword: 'Senhas não conferem' }));
    } else if (confirmPassword && value === confirmPassword) {
      setErrors(prev => ({ ...prev, confirmPassword: '' }));
    }
  };

  const handleConfirmPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setConfirmPassword(value);
    if (password !== value) {
      setErrors(prev => ({ ...prev, confirmPassword: 'Senhas não conferem' }));
    } else {
      setErrors(prev => ({ ...prev, confirmPassword: '' }));
    }
  };

  const handleCurrentPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setCurrentPassword(value);
    if (value) {
      setErrors(prev => ({ ...prev, currentPassword: '' }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Se for usuário logado, validar senha atual
    if (isLoggedInUser) {
      if (!currentPassword) {
        setErrors(prev => ({ ...prev, currentPassword: 'Por favor, informe sua senha atual' }));
        return;
      }
    }

    if (!validatePassword(password)) {
      return;
    }

    if (password !== confirmPassword) {
      setErrors(prev => ({ ...prev, confirmPassword: 'Senhas não conferem' }));
      return;
    }

    // Verificar se a nova senha é diferente da atual (para usuários logados)
    if (isLoggedInUser && currentPassword === password) {
      setErrors(prev => ({ ...prev, password: 'A nova senha deve ser diferente da senha atual' }));
      return;
    }

    const success = await resetPassword(
      password,
      isLoggedInUser ? currentPassword : undefined,
      isLoggedInUser && user?.email ? user.email : undefined,
      isLoggedInUser
    );
    
    if (success) {
      setPassword('');
      setConfirmPassword('');
      setCurrentPassword('');
      
      // Se for usuário logado, redirecionar para perfil após sucesso
      if (isLoggedInUser) {
        setTimeout(() => {
          navigate('/perfil');
        }, 1500);
      }
    }
  };

  if (isValidToken === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-4">
            <div className="flex justify-center">
              <img 
                src="/images/footer-logo.png" 
                alt="Nomeia Aí" 
                className="h-24 w-auto object-contain animate-in fade-in zoom-in duration-500"
              />
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="flex justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isValidToken === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5 p-4">
        <Card className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-500">
          <CardHeader className="text-center space-y-4">
            <div className="flex justify-center">
              <img 
                src="/images/footer-logo.png" 
                alt="Nomeia Aí" 
                className="h-24 w-auto object-contain animate-in fade-in zoom-in duration-500"
              />
            </div>
            <div className="flex justify-center">
              <div className="rounded-full bg-destructive/10 p-4">
                <AlertCircle className="h-12 w-12 text-destructive" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold">Link inválido ou expirado</CardTitle>
            <CardDescription>
              O link de recuperação de senha é inválido ou expirou. Solicite um novo link.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => navigate('/auth/forgot-password')}
              className="w-full"
            >
              Solicitar novo link
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5 p-4">
        <Card className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-500">
          <CardHeader className="space-y-4">
            <div className="flex justify-center">
              <Link to="/">
                <img 
                  src="/images/footer-logo.png" 
                  alt="Nomeia Aí" 
                  className="h-36 w-auto object-contain animate-in fade-in zoom-in duration-500 cursor-pointer hover:opacity-80 transition-opacity"
                />
              </Link>
            </div>
            <div className="text-center">
              <CardTitle className="text-2xl font-bold">
                {isLoggedInUser ? 'Alterar Senha' : 'Redefinir Senha'}
              </CardTitle>
              <CardDescription className="mt-2">
                {isLoggedInUser 
                  ? 'Digite sua senha atual e escolha uma nova senha'
                  : 'Digite sua nova senha abaixo'
                }
              </CardDescription>
            </div>
          </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {isLoggedInUser && (
              <div className="space-y-2">
                <Label htmlFor="current-password">Senha atual</Label>
                <div className="relative">
                  <Input
                    id="current-password"
                    type={showCurrentPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Digite sua senha atual"
                    value={currentPassword}
                    onChange={handleCurrentPasswordChange}
                    required
                    disabled={isLoading}
                    className={errors.currentPassword ? 'border-destructive pr-10' : 'pr-10'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    disabled={isLoading}
                  >
                    {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.currentPassword && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.currentPassword}
                  </p>
                )}
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="password">Nova senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Digite sua nova senha"
                  value={password}
                  onChange={handlePasswordChange}
                  required
                  disabled={isLoading}
                  className={errors.password ? 'border-destructive pr-10' : 'pr-10'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  disabled={isLoading}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.password}
                </p>
              )}
              {password && !errors.password && (
                <PasswordStrengthIndicator password={password} />
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirmar nova senha</Label>
              <div className="relative">
                <Input
                  id="confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Confirme sua nova senha"
                  value={confirmPassword}
                  onChange={handleConfirmPasswordChange}
                  required
                  disabled={isLoading}
                  className={errors.confirmPassword ? 'border-destructive pr-10' : 'pr-10'}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  disabled={isLoading}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.confirmPassword}
                </p>
              )}
              {confirmPassword && !errors.confirmPassword && password === confirmPassword && (
                <div className="flex items-center gap-1 text-xs text-green-600">
                  <CheckCircle className="h-3 w-3" />
                  Senhas conferem
                </div>
              )}
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={
                isLoading || 
                !!errors.password || 
                !!errors.confirmPassword || 
                !!errors.currentPassword ||
                !password || 
                !confirmPassword ||
                (isLoggedInUser && !currentPassword)
              }
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {isLoggedInUser ? 'Alterando...' : 'Redefinindo...'}
                </>
              ) : (
                isLoggedInUser ? 'Alterar senha' : 'Redefinir senha'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ResetPassword;

