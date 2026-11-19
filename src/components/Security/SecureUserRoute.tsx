import React, { useEffect, useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { UserUrlObfuscationService } from '@/services/userUrlObfuscation';
import { LoadingState } from '@/modules/rankings/components/classification/LoadingState';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, Shield, UserX } from 'lucide-react';
import { devLog, sanitizeForLog } from '@/utils/productionLogger';

interface SecureUserRouteProps {
  children: React.ReactNode;
  action: 'profile' | 'followers' | 'following';
}

export const SecureUserRoute: React.FC<SecureUserRouteProps> = ({ 
  children, 
  action 
}) => {
  const { token } = useParams<{ token: string }>();
  const [isValidating, setIsValidating] = useState(true);
  const [isValid, setIsValid] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const validateAccess = async () => {
      if (!token) {
        setError('Token de acesso não fornecido');
        setIsValidating(false);
        return;
      }

      try {
        const validatedUserId = await UserUrlObfuscationService.validateUserToken(token);
        
        if (validatedUserId) {
          setUserId(validatedUserId);
          setIsValid(true);
        } else {
          setError('Token de acesso inválido ou expirado');
        }
      } catch (err) {
        setError('Erro ao validar acesso');
        devLog.error('Erro na validação de usuário:', err);
      } finally {
        setIsValidating(false);
      }
    };

    validateAccess();
  }, [token]);

  if (isValidating) {
    return <LoadingState />;
  }

  if (!isValid || !userId) {
    return (
      <div className="container mx-auto p-4">
        <Card className="max-w-2xl mx-auto">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <UserX className="h-16 w-16 text-destructive" />
            </div>
            <CardTitle className="text-2xl text-destructive">
              Acesso Negado
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <AlertTriangle className="h-5 w-5" />
              <span>{error || 'Token de acesso inválido'}</span>
            </div>
            <p className="text-sm text-muted-foreground">
              O perfil que você está tentando acessar é privado, não existe ou o link expirou.
            </p>
            <div className="pt-4">
              <a 
                href="/comunidade" 
                className="inline-flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
              >
                Voltar para Comunidade
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Passar o userId validado para os componentes filhos
  // ✅ SEGURANÇA: Não expor userId no HTML (data-user-id removido)
  return (
    <div>
      {React.cloneElement(children as React.ReactElement, { 
        userId,
        secureToken: token 
      })}
    </div>
  );
};
