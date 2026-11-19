import React from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { LoginForm } from './LoginForm';
import { SignupForm } from './SignupForm';
import { SocialAuthButtons } from './SocialAuthButtons';
import { useSecureAuth } from '@/hooks/useSecureAuth';
import { useNavigate } from 'react-router-dom';

export const AuthContainer: React.FC = () => {
  const navigate = useNavigate();
  const { isLoading, isLocked, lockoutEnd, handleLogin, handleSignup, resendConfirmationEmail } = useSecureAuth();

  const handleReturnHome = () => {
    navigate('/');
  };

  return (
    <div className="container flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5 py-8 px-4">
      <Card className="w-full max-w-md shadow-xl border-2 animate-in fade-in slide-in-from-bottom-4 duration-500 max-h-[95vh] overflow-y-auto">
        <CardHeader className="space-y-4 pb-4">
          <div className="flex justify-center pt-2">
            <img 
              src="/images/footer-logo.png" 
              alt="Nomeia Aí" 
              className="h-32 w-auto object-contain animate-in fade-in zoom-in duration-500"
            />
          </div>
        </CardHeader>
        
        <CardContent className="px-6">
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="signup">Cadastro</TabsTrigger>
            </TabsList>
            
            <TabsContent value="login">
              <LoginForm
                onSubmit={handleLogin as any}
                onResendConfirmation={resendConfirmationEmail}
                isLoading={isLoading}
                isLocked={isLocked}
                lockoutEnd={lockoutEnd}
              />
            </TabsContent>
            
            <TabsContent value="signup">
              <SignupForm
                onSubmit={handleSignup}
                isLoading={isLoading}
              />
            </TabsContent>
          </Tabs>
          
          <div className="mt-6">
            <SocialAuthButtons />
          </div>
        </CardContent>
        
        <CardFooter className="flex flex-col space-y-4 pt-4">
          <div className="text-sm text-muted-foreground text-center">
            Ao criar uma conta, você concorda com nossos termos de serviço e política de privacidade.
          </div>
          <Button variant="outline" className="w-full" onClick={handleReturnHome}>
            Voltar para a página inicial
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};
