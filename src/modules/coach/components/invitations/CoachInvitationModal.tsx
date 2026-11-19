import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle, Check, X, Shield } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface CoachInvitationModalProps {
  invitation: {
    id: string;
    type: string;
    title: string;
    message: string;
    metadata: {
      coach_id: string;
      coach_name: string;
      invitation_id: string;
      action_url: string;
    };
    created_at: string;
  };
  onClose: () => void;
}

const CoachInvitationModal = ({ invitation, onClose }: CoachInvitationModalProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [consentData, setConsentData] = useState({
    study_data: true,
    statistics: true,
    profile_basic: false
  });

  const acceptInvitation = useMutation({
    mutationFn: async () => {
      // Usar invitation_id do metadata ou ID da notificação como fallback
      const invitationId = invitation.metadata?.invitation_id || invitation.metadata?.invitationId || invitation.id;
      
      if (!invitationId) {
        throw new Error('ID do convite não encontrado.');
      }

      // Verificar se o usuário está autenticado
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) {
        throw new Error('Você precisa estar logado para aceitar convites');
      }
      
      // Não precisamos verificar o convite antes - a função RPC já faz isso
      // Se o convite não for para o usuário ou não existir, a função RPC retornará erro
      
      const { data, error } = await supabase.rpc('accept_coach_invitation', {
        p_invitation_id: invitationId,
        p_consent_data: consentData
      });

      if (error) {
        throw error;
      }
      
      // Verificar se a resposta indica sucesso
      if (!data || !(data as any).success) {
        const errorMsg = (data as any)?.error || 'Erro ao aceitar convite';
        throw new Error(errorMsg);
      }
      
      return data;
    },
    onSuccess: () => {
      toast({
        title: 'Convite aceito!',
        description: 'Você agora faz parte da equipe do coach e aparecerá no painel dele',
      });
      
      // Invalidar cache do coach para atualizar a lista de alunos
      const coachId = invitation.metadata?.coach_id;
      if (coachId) {
        queryClient.invalidateQueries({ queryKey: ['coach-students', coachId] });
        queryClient.invalidateQueries({ queryKey: ['coach-can-invite', coachId] });
        queryClient.invalidateQueries({ queryKey: ['coach-pending-invitations', coachId] });
      }
      
      // Invalidar também para o usuário atual (caso seja o próprio coach testando)
      queryClient.invalidateQueries({ queryKey: ['coach-students'] });
      queryClient.invalidateQueries({ queryKey: ['coach-can-invite'] });
      queryClient.invalidateQueries({ queryKey: ['coach-pending-invitations'] });
      
      // Invalidar notificações (a função SQL já remove, mas forçamos atualização)
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      
      // Remover notificação da lista localmente se necessário
      if (currentUser?.id) {
        queryClient.setQueryData(['notifications', currentUser.id], (old: any) => {
          if (!old) return old;
          const invitationId = invitation.metadata?.invitation_id || invitation.metadata?.invitationId || invitation.id;
          return old.filter((n: any) => {
            const nInvitationId = n.metadata?.invitation_id || n.metadata?.invitationId || n.id;
            return nInvitationId !== invitationId;
          });
        });
      }
      
      onClose();
      
      // Navegar para o dashboard se for o próprio coach visualizando
      // Ou apenas mostrar mensagem de sucesso
      setTimeout(() => {
        if (window.location.pathname.includes('/coach')) {
          navigate('/coach/dashboard');
        }
      }, 1000);
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao aceitar convite',
        description: error.message || 'Não foi possível aceitar o convite',
        variant: 'destructive'
      });
    }
  });

  const rejectInvitation = useMutation({
    mutationFn: async () => {
      const invitationId = invitation.metadata?.invitation_id || invitation.metadata?.invitationId || invitation.id;
      
      // Verificar se o usuário está autenticado
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) {
        throw new Error('Você precisa estar logado para recusar convites');
      }
      
      // Verificar o convite antes de rejeitar
      const { data: invitationData } = await supabase
        .from('coach_invitations_history')
        .select('id, student_id, student_email, status')
        .eq('id', invitationId)
        .single();
      
      if (!invitationData) {
        throw new Error('Convite não encontrado');
      }
      
      // Verificar se o convite está para o usuário atual
      if (invitationData.student_id && invitationData.student_id !== currentUser.id) {
        if (invitationData.student_email !== currentUser.email) {
          throw new Error('Este convite não é para você');
        }
      }
      
      // Deletar o convite em vez de apenas atualizar status
      const { error } = await supabase
        .from('coach_invitations_history')
        .delete()
        .eq('id', invitationId);

      if (error) throw error;
      
      // Remover notificação
      await supabase
        .from('notifications')
        .delete()
        .eq('type', 'coach_invitation')
        .eq('metadata->>invitation_id', invitationId);
    },
    onSuccess: () => {
      toast({
        title: 'Convite recusado',
        description: 'Você pode aceitar outro convite depois se quiser',
      });
      
      // Invalidar notificações para remover a notificação do convite recusado
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      
      // Remover notificação da lista localmente
      if (currentUser?.id) {
        queryClient.setQueryData(['notifications', currentUser.id], (old: any) => {
          if (!old) return old;
          const invitationId = invitation.metadata?.invitation_id || invitation.metadata?.invitationId || invitation.id;
          return old.filter((n: any) => {
            const nInvitationId = n.metadata?.invitation_id || n.metadata?.invitationId || n.id;
            return nInvitationId !== invitationId;
          });
        });
      }
      
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  return (
    <Dialog open={true} onOpenChange={(open) => {
      if (!open) {
        onClose();
      }
    }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            Convite para Equipe de Estudos
          </DialogTitle>
          <DialogDescription>
            Você foi convidado(a) por <strong>{invitation.metadata?.coach_name || 'um coach'}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Mensagem do coach */}
          {invitation.message && (
            <Card className="bg-accent/50 border-border">
              <CardContent className="p-4">
                <p className="text-sm text-foreground">
                  <strong>{invitation.metadata?.coach_name || 'Coach'} diz:</strong> 
                  <br />
                  {invitation.message}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Termos LGPD */}
          <Alert className="border-yellow-500/50 bg-yellow-500/10 dark:border-yellow-400/50 dark:bg-yellow-400/10">
            <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
            <div className="text-sm">
              <strong className="font-semibold text-foreground">Importante - Lei LGPD:</strong>
              <br />
              <span className="text-muted-foreground">
                Ao aceitar este convite, você autoriza que <strong className="text-foreground">{invitation.metadata.coach_name}</strong> 
                {' '}tenha acesso apenas aos seus dados de estudos e estatísticas da plataforma Nomeia Aí.
              </span>
            </div>
          </Alert>

          {/* O que o coach terá acesso */}
          <div className="space-y-3">
            <h4 className="font-semibold text-foreground flex items-center gap-2">
              <Check className="h-5 w-5 text-primary" />
              O que o coach terá acesso:
            </h4>
            <ul className="space-y-2 text-sm ml-7 text-muted-foreground">
              <li className="flex items-start gap-2">
                <Check className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                <span>Dados de estudos: horas de estudo, sessões realizadas</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                <span>Ciclos de estudo ativos e concluídos</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                <span>Estatísticas gerais de desempenho</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                <span>Progresso semanal e mensal</span>
              </li>
            </ul>
          </div>

          {/* O que o coach NÃO terá acesso */}
          <div className="space-y-3">
            <h4 className="font-semibold text-foreground flex items-center gap-2">
              <X className="h-5 w-5 text-muted-foreground" />
              O que o coach NÃO terá acesso:
            </h4>
            <ul className="space-y-2 text-sm ml-7 text-muted-foreground">
              <li className="flex items-start gap-2">
                <X className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                <span>Seu perfil completo (foto, bio, dados pessoais)</span>
              </li>
              <li className="flex items-start gap-2">
                <X className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                <span>Rankings e respostas de provas</span>
              </li>
              <li className="flex items-start gap-2">
                <X className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                <span>Dados de concursos específicos</span>
              </li>
              <li className="flex items-start gap-2">
                <X className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                <span>Interações sociais (mensagens, comentários)</span>
              </li>
            </ul>
          </div>

          {/* Checkboxes de consentimento */}
          <div className="space-y-4 border-t pt-4">
            <h4 className="font-semibold">Consentimento - Lei LGPD</h4>
            
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="study_data"
                  checked={consentData.study_data}
                  onCheckedChange={(checked) => 
                    setConsentData({ ...consentData, study_data: checked as boolean })
                  }
                  className="mt-1"
                />
                <Label htmlFor="study_data" className="text-sm cursor-pointer">
                  Autorizo o acesso aos meus dados de estudos (horas, sessões, ciclos de estudo)
                </Label>
              </div>

              <div className="flex items-start gap-3">
                <Checkbox
                  id="statistics"
                  checked={consentData.statistics}
                  onCheckedChange={(checked) => 
                    setConsentData({ ...consentData, statistics: checked as boolean })
                  }
                  className="mt-1"
                />
                <Label htmlFor="statistics" className="text-sm cursor-pointer">
                  Autorizo o acesso às minhas estatísticas gerais de desempenho
                </Label>
              </div>

              <div className="flex items-start gap-3">
                <Checkbox
                  id="profile_basic"
                  checked={consentData.profile_basic}
                  onCheckedChange={(checked) => 
                    setConsentData({ ...consentData, profile_basic: checked as boolean })
                  }
                  className="mt-1"
                />
                <Label htmlFor="profile_basic" className="text-sm cursor-pointer">
                  Autorizo o acesso ao meu nome público (opcional)
                </Label>
              </div>
            </div>

            <div className="bg-muted rounded-lg p-3 text-xs text-muted-foreground">
              <p className="font-semibold mb-1 text-foreground">⚠️ Importante:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Você pode revogar este acesso a qualquer momento nas configurações</li>
                <li>Seus dados pessoais privados nunca serão compartilhados</li>
                <li>O coach não terá acesso a rankings, respostas ou dados sensíveis</li>
                <li>Esta autorização é específica para fins educacionais</li>
              </ul>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => rejectInvitation.mutate()}
            disabled={acceptInvitation.isPending || rejectInvitation.isPending}
          >
            <X className="mr-2 h-4 w-4" />
            Recusar
          </Button>
          <Button
            onClick={() => acceptInvitation.mutate()}
            disabled={
              acceptInvitation.isPending || 
              rejectInvitation.isPending ||
              !consentData.study_data ||
              !consentData.statistics
            }
          >
            <Check className="mr-2 h-4 w-4" />
            Aceitar Convite
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CoachInvitationModal;

