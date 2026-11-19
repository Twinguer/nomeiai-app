
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Eye, EyeOff } from 'lucide-react';

interface LoginFormProps {
  onSubmit: (email: string, password: string) => Promise<{ success: boolean; emailNotConfirmed?: boolean }>;
  onResendConfirmation?: (email: string) => Promise<void>;
  isLoading: boolean;
  isLocked: boolean;
  lockoutEnd: number | null;
}

export const LoginForm: React.FC<LoginFormProps> = ({
  onSubmit,
  onResendConfirmation,
  isLoading,
  isLocked,
  lockoutEnd
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showResendOption, setShowResendOption] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await onSubmit(email, password);
    // Se o login falhou por email não confirmado, mostrar opção de reenvio
    if (result && 'emailNotConfirmed' in result && result.emailNotConfirmed) {
      setShowResendOption(true);
    } else {
      setShowResendOption(false);
    }
  };

  const getRemainingLockoutTime = () => {
    if (!lockoutEnd) return 0;
    return Math.ceil((lockoutEnd - Date.now()) / 60000);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {isLocked && lockoutEnd && (
        <Alert variant="destructive" className="animate-in fade-in slide-in-from-top-2 duration-300">
          <AlertDescription>
            <p className="font-medium">Conta temporariamente bloqueada</p>
            <p>Muitas tentativas de login. Tente novamente em {getRemainingLockoutTime()} minutos.</p>
          </AlertDescription>
        </Alert>
      )}
      
      <div className="space-y-2">
        <Label htmlFor="login-email">Email</Label>
        <Input
          id="login-email"
          type="email"
          autoComplete="email"
          placeholder="seu@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={isLocked || isLoading}
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="login-password">Senha</Label>
        <div className="relative">
          <Input
            id="login-password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="Digite sua senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={isLocked || isLoading}
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
            disabled={isLocked || isLoading}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <div className="flex items-center justify-between">
          <Link
            to="/auth/forgot-password"
            className="text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            Esqueci minha senha
          </Link>
        </div>
      </div>

      {showResendOption && onResendConfirmation && (
        <Alert className="animate-in fade-in slide-in-from-top-2 duration-300">
          <AlertDescription className="flex items-center justify-between">
            <span className="text-sm">Email não confirmado. Deseja reenviar o email de confirmação?</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={async () => {
                if (email && onResendConfirmation) {
                  const success = await onResendConfirmation(email);
                  if (success) {
                    setShowResendOption(false);
                  }
                }
              }}
              disabled={isLoading || !email}
            >
              Reenviar
            </Button>
          </AlertDescription>
        </Alert>
      )}
      
      <Button 
        type="submit" 
        className="w-full transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]" 
        disabled={isLocked || isLoading}
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Entrando...
          </>
        ) : (
          'Entrar'
        )}
      </Button>
    </form>
  );
};
