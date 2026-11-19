import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Sparkles, Users, TrendingUp } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { trackConversion } from '@/lib/analytics';

const ConfirmacaoSucesso: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    trackConversion('signup_confirm');
  }, []);

  useEffect(() => {
    if (user) {
      const timer = setTimeout(() => {
        navigate('/auth');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [user, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5 p-4">
      <Card className="w-full max-w-2xl shadow-lg border-2">
        <CardHeader className="text-center space-y-6 pb-8">
          <div className="flex justify-center">
            <div className="relative">
              <CheckCircle2 className="h-20 w-20 text-green-600 animate-in zoom-in duration-500" />
              <Sparkles className="h-8 w-8 text-yellow-500 absolute -top-2 -right-2 animate-pulse" />
            </div>
          </div>
          <div className="space-y-2">
            <CardTitle className="text-3xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Bem-vindo ao Nomeia Aí!
            </CardTitle>
            <CardDescription className="text-lg">
              Seu email foi confirmado com sucesso! 🎉
            </CardDescription>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-8">
          <div className="grid gap-6 md:grid-cols-3">
            <div className="flex flex-col items-center text-center space-y-2 p-4 rounded-lg bg-primary/5">
              <Users className="h-8 w-8 text-primary" />
              <h3 className="font-semibold">Comunidade Ativa</h3>
              <p className="text-sm text-muted-foreground">
                Participe de rankings e compare seu desempenho
              </p>
            </div>
            
            <div className="flex flex-col items-center text-center space-y-2 p-4 rounded-lg bg-secondary/5">
              <TrendingUp className="h-8 w-8 text-secondary" />
              <h3 className="font-semibold">Acompanhe sua Evolução</h3>
              <p className="text-sm text-muted-foreground">
                Monitore seu progresso em tempo real
              </p>
            </div>
            
            <div className="flex flex-col items-center text-center space-y-2 p-4 rounded-lg bg-accent/5">
              <Sparkles className="h-8 w-8 text-accent" />
              <h3 className="font-semibold">Recursos Exclusivos</h3>
              <p className="text-sm text-muted-foreground">
                Acesse ferramentas de estudo avançadas
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <p className="text-center text-muted-foreground">
              {user 
                ? 'Você será redirecionado para a tela de login em instantes...'
                : 'Faça login para começar a usar a plataforma!'}
            </p>
            
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button 
                onClick={() => navigate('/auth')} 
                size="lg"
                className="min-w-[200px]"
              >
                Fazer Login
              </Button>
              
              <Button 
                onClick={() => navigate('/')} 
                variant="outline"
                size="lg"
                className="min-w-[200px]"
              >
                Voltar ao Início
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ConfirmacaoSucesso;
