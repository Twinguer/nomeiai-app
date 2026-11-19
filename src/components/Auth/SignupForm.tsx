
import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-react';
import { PasswordValidator } from '@/utils/passwordValidator';
import { PasswordStrengthIndicator } from './PasswordStrengthIndicator';
import { TurnstileCaptcha } from '@/components/Security/TurnstileCaptcha';
import { LaunchPromoBanner } from '@/modules/payments';

interface SignupFormProps {
  onSubmit: (email: string, password: string, name: string, nickname?: string, captchaToken?: string) => Promise<void>;
  isLoading: boolean;
}

export const SignupForm: React.FC<SignupFormProps> = ({ onSubmit, isLoading }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [captchaToken, setCaptchaToken] = useState<string>('');
  const [captchaError, setCaptchaError] = useState(false);

  const validateEmail = useCallback((email: string): boolean => {
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    return emailRegex.test(email) && email.length <= 254;
  }, []);

  const validatePassword = useCallback((password: string): boolean => {
    const validation = PasswordValidator.validate(password);
    return validation.isValid;
  }, []);

  const handleCaptchaSuccess = useCallback((token: string) => {
    setCaptchaToken(token);
    setCaptchaError(false);
    // Limpar erro de captcha se houver
    if (errors.captcha) {
      setErrors(prev => ({ ...prev, captcha: '' }));
    }
  }, [errors.captcha]);

  const handleCaptchaError = useCallback(() => {
    setCaptchaToken('');
    setCaptchaError(true);
    setErrors(prev => ({ ...prev, captcha: 'Erro na verificação de segurança. Tente novamente.' }));
  }, []);

  const validateForm = useCallback(() => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = 'Nome é obrigatório';
    } else if (name.trim().length < 2) {
      newErrors.name = 'Nome deve ter pelo menos 2 caracteres';
    }

    if (!email) {
      newErrors.email = 'Email é obrigatório';
    } else if (!validateEmail(email)) {
      newErrors.email = 'Email inválido';
    }

    if (!password) {
      newErrors.password = 'Senha é obrigatória';
    } else if (!validatePassword(password)) {
      const validation = PasswordValidator.validate(password);
      newErrors.password = validation.errors[0] || 'Senha não atende aos requisitos de segurança';
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = 'Confirmação de senha é obrigatória';
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Senhas não conferem';
    }

    // Validar captcha
    if (!captchaToken) {
      newErrors.captcha = 'Por favor, complete a verificação de segurança';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [name, email, password, confirmPassword, captchaToken, validateEmail, validatePassword]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    await onSubmit(email, password, name, nickname.trim() || undefined, captchaToken);
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEmail(value);
    if (errors.email && validateEmail(value)) {
      setErrors(prev => ({ ...prev, email: '' }));
    }
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPassword(value);
    if (errors.password && validatePassword(value)) {
      setErrors(prev => ({ ...prev, password: '' }));
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

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setName(value);
    if (errors.name && value.trim().length >= 2) {
      setErrors(prev => ({ ...prev, name: '' }));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 animate-in fade-in duration-300">
      <div className="space-y-2">
        <Label htmlFor="signup-name">Nome Completo</Label>
        <div className="relative">
          <Input
            id="signup-name"
            type="text"
            autoComplete="name"
            placeholder="Nome Completo"
            value={name}
            onChange={handleNameChange}
            required
            disabled={isLoading}
            className={errors.name ? 'border-destructive' : ''}
          />
          {name && !errors.name && (
            <CheckCircle className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-green-600 animate-in fade-in zoom-in duration-200" />
          )}
          {errors.name && (
            <AlertCircle className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-destructive animate-in fade-in zoom-in duration-200" />
          )}
        </div>
        {errors.name && (
          <p className="text-xs text-destructive animate-in fade-in slide-in-from-top-1 duration-200">{errors.name}</p>
        )}
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="signup-email">Email</Label>
        <div className="relative">
          <Input
            id="signup-email"
            type="email"
            autoComplete="email"
            placeholder="seu@email.com"
            value={email}
            onChange={handleEmailChange}
            required
            disabled={isLoading}
            className={errors.email ? 'border-destructive' : ''}
          />
          {email && !errors.email && validateEmail(email) && (
            <CheckCircle className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-green-600 animate-in fade-in duration-200" />
          )}
          {errors.email && (
            <AlertCircle className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-destructive animate-in fade-in duration-200" />
          )}
        </div>
        {errors.email && (
          <p className="text-xs text-destructive animate-in fade-in slide-in-from-top-1 duration-200">{errors.email}</p>
        )}
        {email && !errors.email && validateEmail(email) && (
          <p className="text-xs text-green-600 flex items-center gap-1 animate-in fade-in duration-200">
            <CheckCircle className="h-3 w-3" />
            Formato de email válido
          </p>
        )}
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="signup-password">Senha</Label>
        <div className="relative">
          <Input
            id="signup-password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="Digite sua senha"
            value={password}
            onChange={handlePasswordChange}
            required
            disabled={isLoading}
            className={errors.password ? 'border-destructive pr-10' : 'pr-10'}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
            disabled={isLoading}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {errors.password && (
          <p className="text-xs text-destructive animate-in fade-in slide-in-from-top-1 duration-200">{errors.password}</p>
        )}
        <PasswordStrengthIndicator password={password} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="signup-confirm-password">Confirmar Senha</Label>
        <div className="relative">
          <Input
            id="signup-confirm-password"
            type={showConfirmPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="Confirme sua senha"
            value={confirmPassword}
            onChange={handleConfirmPasswordChange}
            required
            disabled={isLoading}
            className={errors.confirmPassword ? 'border-destructive pr-10' : 'pr-10'}
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
            disabled={isLoading}
          >
            {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {errors.confirmPassword && (
          <p className="text-xs text-destructive animate-in fade-in slide-in-from-top-1 duration-200">{errors.confirmPassword}</p>
        )}
        {confirmPassword && !errors.confirmPassword && password === confirmPassword && (
          <div className="flex items-center gap-1 text-xs text-green-600 animate-in fade-in duration-200">
            <CheckCircle className="h-3 w-3" />
            Senhas conferem
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="signup-nickname">Nickname (Opcional)</Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">@</span>
          <Input
            id="signup-nickname"
            type="text"
            placeholder="meunickname"
            value={nickname}
            onChange={(e) => {
              let value = e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, '');
              if (value.length <= 20) {
                setNickname(value);
              }
            }}
            disabled={isLoading}
            className="pl-8"
            maxLength={20}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {nickname.length === 0 ? (
            'Se não informar, será gerado automaticamente baseado no seu nome'
          ) : nickname.length < 3 ? (
            'Mínimo 3 caracteres'
          ) : /^[a-z0-9_.]{3,20}$/.test(nickname) ? (
            <span className="text-green-600">✓ Nickname válido</span>
          ) : (
            'Apenas letras minúsculas, números, underscore ou ponto'
          )}
        </p>
      </div>

      <div className="space-y-2">
        <TurnstileCaptcha
          siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY || ''}
          onSuccess={handleCaptchaSuccess}
          onError={handleCaptchaError}
          className="mt-2"
        />
        {captchaError && (
          <Alert variant="destructive" className="mt-2">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Erro na verificação de segurança. Por favor, tente novamente.
            </AlertDescription>
          </Alert>
        )}
        {errors.captcha && (
          <p className="text-xs text-destructive animate-in fade-in slide-in-from-top-1 duration-200">{errors.captcha}</p>
        )}
      </div>

      <LaunchPromoBanner compact className="text-center" />

      <Button 
        type="submit" 
        className="w-full transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]" 
        disabled={isLoading || Object.keys(errors).some(key => errors[key])}
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Criando conta...
          </>
        ) : (
          'Criar conta'
        )}
      </Button>
    </form>
  );
};
