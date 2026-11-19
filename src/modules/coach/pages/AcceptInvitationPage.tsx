import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Check, X, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  canRespondToInvitation,
  coachInvitationService,
} from '@/modules/coach';

const AcceptInvitationPage = () => {
  const navigate = useNavigate();
  const { invitationId } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();

  const [consentData] = useState({
    study_data: true,
    statistics: true,
    profile_basic: false,
  });

  const [isLoading, setIsLoading] = useState(false);

  const { data: invitation, isLoading: isLoadingInvitation } = useQuery({
    queryKey: ['coach-invitation', invitationId],
    queryFn: () => coachInvitationService.fetchInvitationById(invitationId!),
    enabled: !!invitationId,
  });

  const acceptInvitation = async () => {
    if (!user?.id || !invitationId) return;

    setIsLoading(true);

    try {
      await coachInvitationService.acceptInvitation(invitationId, consentData);

      toast({
        title: 'Convite aceito!',
        description: 'Você agora faz parte da equipe do coach',
      });

      navigate('/coach/dashboard');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      toast({
        title: 'Erro ao aceitar convite',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const rejectInvitation = async () => {
    if (!invitationId) return;

    setIsLoading(true);

    try {
      await coachInvitationService.rejectInvitation(invitationId);

      toast({
        title: 'Convite recusado',
        description: 'Você pode aceitar outro convite depois se quiser',
      });

      navigate('/');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      toast({
        title: 'Erro',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoadingInvitation) {
    return (
      <div className="container mx-auto p-6 max-w-2xl">
        <Card>
          <CardContent className="p-8 text-center">
            <p>Carregando convite...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!invitation) {
    return (
      <div className="container mx-auto p-6 max-w-2xl">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Convite não encontrado</AlertTitle>
          <AlertDescription>
            Este convite não existe ou já foi respondido.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (
    !canRespondToInvitation(
      invitation.status,
      invitation.expires_at ?? invitation.invited_at
    )
  ) {
    return (
      <div className="container mx-auto p-6 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Convite já foi respondido</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Você já respondeu a este convite anteriormente.
            </p>
            <Button onClick={() => navigate('/')}>Voltar</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const coachName = invitation.coach?.name || 'Coach';

  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Convite para Equipe de Estudos</CardTitle>
          <CardDescription>
            Você foi convidado(a) por {coachName}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {invitation.invitation_message && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>{coachName} diz:</strong> {invitation.invitation_message}
              </p>
            </div>
          )}

          <div>
            <h3 className="font-semibold mb-3 text-green-700 flex items-center gap-2">
              <Check className="h-5 w-5 text-green-600" />
              O que {coachName} terá acesso:
            </h3>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-600" />
                Módulo de estudos (horas, sessões, ciclos)
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-600" />
                Estatísticas gerais de estudos
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-600" />
                Seu progresso nos estudos
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-3 text-red-700 flex items-center gap-2">
              <X className="h-5 w-5 text-red-600" />
              O que {coachName} NÃO terá acesso:
            </h3>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <X className="h-4 w-4 text-red-600" />
                Rankings e respostas de provas
              </li>
              <li className="flex items-center gap-2">
                <X className="h-4 w-4 text-red-600" />
                Dados de concursos específicos
              </li>
              <li className="flex items-center gap-2">
                <X className="h-4 w-4 text-red-600" />
                Seu perfil completo
              </li>
            </ul>
          </div>

          <div className="flex gap-4 pt-4">
            <Button
              onClick={acceptInvitation}
              disabled={isLoading}
              className="flex-1"
            >
              Aceitar Convite
            </Button>
            <Button
              variant="outline"
              onClick={rejectInvitation}
              disabled={isLoading}
            >
              Recusar
            </Button>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Você pode sair da equipe a qualquer momento nas configurações
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default AcceptInvitationPage;
