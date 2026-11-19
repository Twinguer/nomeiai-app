import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, ArrowLeft, Mail } from 'lucide-react';
import { usePasswordReset } from '@/hooks/usePasswordReset';

const ForgotPassword: React.FC = () => {
  const navigate = useNavigate();
  const { isLoading, requestPasswordReset } = usePasswordReset();
  const [email, setEmail] = useState('');
  const [emailSent, setEmailSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await requestPasswordReset(email);
    if (success) {
      setEmailSent(true);
    }
  };

  if (emailSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5 p-4">
        <Card className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-500">
          <CardHeader className="text-center space-y-4">
            <div className="flex justify-center">
              <img 
                src="/images/footer-logo.png" 
                alt="Nomeia Aí" 
                className="h-12 w-auto object-contain animate-in fade-in zoom-in duration-500"
              />
            </div>
            <div className="flex justify-center">
              <div className="rounded-full bg-primary/10 p-4">
                <Mail className="h-12 w-12 text-primary" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold">Email enviado!</CardTitle>
            <CardDescription className="text-base">
              Verifique sua caixa de entrada e spam. Se o email estiver cadastrado, você receberá um link para redefinir sua senha.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted/50 p-4 rounded-lg">
              <p className="text-sm text-muted-foreground text-center">
                <strong>Não recebeu o email?</strong>
                <br />
                Verifique sua pasta de spam ou lixo eletrônico. O email pode levar alguns minutos para chegar.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Button
                onClick={() => {
                  setEmailSent(false);
                  setEmail('');
                }}
                variant="outline"
                className="w-full"
              >
                Enviar novamente
              </Button>
              <Button
                onClick={() => navigate('/auth')}
                variant="ghost"
                className="w-full"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar para o login
              </Button>
            </div>
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
              <img 
                src="/images/footer-logo.png" 
                alt="Nomeia Aí" 
                className="h-12 w-auto object-contain animate-in fade-in zoom-in duration-500"
              />
            </div>
            <CardTitle className="text-2xl font-bold text-center">Recuperar senha</CardTitle>
          <CardDescription className="text-center">
            Digite seu email e enviaremos um link para redefinir sua senha
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
                className="transition-all duration-200"
              />
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4 mr-2" />
                  Enviar link de recuperação
                </>
              )}
            </Button>

            <div className="text-center">
              <Link
                to="/auth"
                className="text-sm text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1"
              >
                <ArrowLeft className="h-3 w-3" />
                Voltar para o login
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ForgotPassword;

