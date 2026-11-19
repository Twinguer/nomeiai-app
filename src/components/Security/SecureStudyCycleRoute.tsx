import React, { useEffect, useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Shield, AlertTriangle, BookOpen } from 'lucide-react';
import { devLog, sanitizeForLog } from '@/utils/productionLogger';

interface SecureStudyCycleRouteProps {
  children: React.ReactNode;
  action: 'view' | 'edit' | 'session' | 'cronograma' | 'timer' | 'estatisticas';
}

const SecureStudyCycleRoute: React.FC<SecureStudyCycleRouteProps> = ({ children, action }) => {
  const { token } = useParams<{ token: string }>();
  const { user } = useAuth();
  const [isValidating, setIsValidating] = useState(true);
  const [isValid, setIsValid] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cycleId, setCycleId] = useState<string | null>(null);

  useEffect(() => {
    const validateToken = async () => {
      if (!token || !user) {
        setError('Token de acesso não fornecido ou usuário não autenticado');
        setIsValidating(false);
        return;
      }

      try {
        const { StudyCycleUrlObfuscationService } = await import('@/services/studyCycleUrlObfuscation');
        const validatedCycleId = await StudyCycleUrlObfuscationService.validateStudyCycleToken(token, user.id);
        
        if (validatedCycleId) {
          setCycleId(validatedCycleId);
          setIsValid(true);
        } else {
          setError('Token de acesso inválido ou expirado');
        }
      } catch (err) {
        devLog.error('Erro ao validar token de ciclo de estudo:', err);
        setError('Erro ao validar acesso ao ciclo de estudo');
      } finally {
        setIsValidating(false);
      }
    };

    validateToken();
  }, [token, user]);

  if (isValidating) {
    return (
      <div className="container mx-auto p-6">
        <Card className="max-w-md mx-auto">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
            <CardTitle>Validando Acesso</CardTitle>
            <CardDescription>
              Verificando permissões de acesso ao ciclo de estudo...
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!isValid || error) {
    return (
      <div className="container mx-auto p-6">
        <Card className="max-w-md mx-auto">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
            <CardTitle className="text-destructive">Acesso Negado</CardTitle>
            <CardDescription>
              {error || 'Token de acesso inválido'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert>
              <Shield className="h-4 w-4" />
              <AlertDescription>
                Este ciclo de estudo requer um token de acesso válido. 
                {action === 'view' ? ' Acesse através da sua lista de ciclos.' : 
                 action === 'edit' ? ' Edite através da sua lista de ciclos.' : 
                 ' Inicie uma sessão através da sua lista de ciclos.'}
              </AlertDescription>
            </Alert>
            <div className="mt-4 text-center">
              <a 
                href="/estudos" 
                className="text-primary hover:underline"
              >
                <BookOpen className="inline mr-2 h-4 w-4" />
                Voltar para Estudos
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Passar o cycleId validado para os componentes filhos
  return (
    <div>
      {React.cloneElement(children as React.ReactElement, { 
        cycleId,
        secureToken: token 
      })}
    </div>
  );
};

export default SecureStudyCycleRoute;
