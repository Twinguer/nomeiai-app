import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Shield } from 'lucide-react';
import { TurnstileCaptcha } from '@/components/Security/TurnstileCaptcha';
import { AdminUrlObfuscationService } from '@/services/adminUrlObfuscation';
import { devLog } from '@/utils/productionLogger';
import { checkIsPlatformAdmin } from '@/utils/adminRole';

export const SecureAdminLogin: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);

    return () => {
      document.head.removeChild(meta);
    };
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!captchaToken) {
      toast.error('Complete a verificação de segurança');
      return;
    }

    setIsLoading(true);

    try {
      const { data: captchaData, error: captchaError } = await supabase.functions.invoke('validate-turnstile', {
        body: { token: captchaToken },
      });

      if (captchaError || !captchaData?.valid) {
        toast.error('Verificação de segurança falhou. Tente novamente.');
        setCaptchaToken(null);
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        toast.error('Credenciais inválidas');
        return;
      }

      if (data.user) {
        const isPlatformAdmin = await checkIsPlatformAdmin();

        if (!isPlatformAdmin) {
          toast.error('Acesso negado. Você não tem permissões de administrador.');
          await supabase.auth.signOut();
          return;
        }

        await supabase.rpc('log_admin_operation', {
          operation_type: 'admin_login',
          operation_details: {
            login_time: new Date().toISOString(),
            user_email: email,
          },
        });

        const dashboardUrl = await AdminUrlObfuscationService.generateSecureDashboardUrl(data.user.id);
        navigate(dashboardUrl);
      }
    } catch (error) {
      devLog.error('Login error:', error);
      toast.error('Erro interno do sistema');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Shield className="h-12 w-12 text-primary" />
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
                placeholder="admin@example.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
                placeholder="••••••••"
              />
            </div>

            <TurnstileCaptcha
              siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY || ''}
              onSuccess={setCaptchaToken}
              onError={() => setCaptchaToken(null)}
            />

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading || !captchaToken}
            >
              {isLoading ? 'Authenticating...' : 'Secure Login'}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <Button
              variant="ghost"
              onClick={() => navigate('/')}
              className="text-sm"
            >
              ← Return to Main Site
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
