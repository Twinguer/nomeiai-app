import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AdminUrlObfuscationService } from '@/services/adminUrlObfuscation';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, Shield } from 'lucide-react';
import type { AdminResource } from '@/config/adminRoutes';
import { devLog } from '@/utils/productionLogger';

interface SecureAdminRouteProps {
  children: React.ReactNode;
  resource: AdminResource;
}

const SecureAdminRoute: React.FC<SecureAdminRouteProps> = ({ children, resource }) => {
  const { token } = useParams<{ token: string }>();
  const { isAdmin, isLoading: adminLoading } = useAdminAuth();
  const { user } = useAuth();
  const [isValidating, setIsValidating] = useState(true);
  const [isValid, setIsValid] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const validateAccess = async () => {
      if (!token) {
        setError('Token de acesso não fornecido');
        setIsValidating(false);
        return;
      }

      try {
        const resolved = await AdminUrlObfuscationService.validateAdminToken(token);

        if (!resolved) {
          setError('Token de acesso inválido ou expirado');
          return;
        }

        if (resolved.resource !== resource) {
          setError('Token não corresponde a esta área');
          return;
        }

        if (user?.id && resolved.adminId !== user.id) {
          setError('Token não pertence a esta sessão');
          return;
        }

        setIsValid(true);
      } catch (err) {
        devLog.error('Admin token validation error:', err);
        setError('Erro ao validar acesso');
      } finally {
        setIsValidating(false);
      }
    };

    validateAccess();
  }, [token, resource, user?.id]);

  if (adminLoading || isValidating) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!isAdmin || !isValid) {
    return (
      <div className="container mx-auto p-4">
        <Card className="max-w-2xl mx-auto">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <Shield className="h-16 w-16 text-destructive" />
            </div>
            <CardTitle className="text-2xl text-destructive">Acesso negado</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <AlertTriangle className="h-5 w-5" />
              <span>{error || 'Você não tem permissão para acessar esta área'}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
};

export default SecureAdminRoute;
