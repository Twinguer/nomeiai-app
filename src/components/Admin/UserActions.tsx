
import React from 'react';
import { Button } from '@/components/ui/button';
import { Trash2, UserX } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { logError } from '@/utils/secureLogger';
import { checkIsPlatformAdmin } from '@/utils/adminRole';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface UserActionsProps {
  userId: string;
  concursoId?: string;
  userName: string;
  onSuccess?: () => void;
  showOnlyRankingActions?: boolean;
}

export const UserActions: React.FC<UserActionsProps> = ({ 
  userId, 
  concursoId, 
  userName,
  onSuccess,
  showOnlyRankingActions = false
}) => {
  const { toast } = useToast();
  const [showDeleteFromRanking, setShowDeleteFromRanking] = React.useState(false);
  const [showDeleteProfile, setShowDeleteProfile] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);

  const handleDeleteFromRanking = async () => {
    if (!concursoId) {
      toast({
        title: 'Erro ao remover usuário',
        description: 'Concurso não identificado para esta ação.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.rpc('admin_remove_user_from_concurso', {
        p_user_id: userId,
        p_concurso_id: concursoId,
      });

      if (error) {
        logError('Error calling admin_remove_user_from_concurso RPC', error, 'ADMIN');
        throw error;
      }

      if (data === false) {
        logError('admin_remove_user_from_concurso returned false', { userId, concursoId }, 'ADMIN');
        toast({
          title: "Erro ao remover usuário",
          description: "Não foi possível remover o usuário do ranking.",
          variant: "destructive"
        });
        return;
      }

      toast({
        title: "Usuário removido do ranking",
        description: `${userName} foi removido com sucesso do ranking.`
      });

      if (onSuccess) onSuccess();
    } catch (error: any) {
      logError('Error deleting user from ranking', error, 'ADMIN');
      toast({
        title: "Erro ao remover usuário",
        description: error.message || "Não foi possível remover o usuário do ranking.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
      setShowDeleteFromRanking(false);
    }
  };

  const handleDeleteProfile = async () => {
    setIsLoading(true);
    try {
      // Verificar se o usuário atual tem permissão de admin antes de tentar excluir
      const { data: currentUser } = await supabase.auth.getUser();
      if (!currentUser?.user) {
        toast({
          title: "Erro de autenticação",
          description: "Você precisa estar autenticado para realizar esta ação.",
          variant: "destructive"
        });
        return;
      }

      const isPlatformAdmin = await checkIsPlatformAdmin();

      if (!isPlatformAdmin) {
        logError('User does not have admin role', { userId: currentUser.user.id }, 'ADMIN');
        toast({
          title: "Permissão negada",
          description: "Você não tem permissões de administrador para excluir perfis.",
          variant: "destructive"
        });
        return;
      }

      // Verificar se o usuário a ser excluído existe
      const { data: targetUser, error: targetError } = await supabase
        .from('users_profiles')
        .select('id')
        .eq('id', userId)
        .single();

      if (targetError || !targetUser) {
        logError('Target user not found', { userId }, 'ADMIN');
        toast({
          title: "Usuário não encontrado",
          description: "O usuário que você está tentando excluir não existe mais.",
          variant: "destructive"
        });
        return;
      }

      // Tentar excluir o perfil
      const { data, error } = await supabase
        .rpc('admin_delete_user_profile', {
          user_id_param: userId
        });

      if (error) {
        logError('Error calling admin_delete_user_profile RPC', error, 'ADMIN');
        throw error;
      }

      // A função retorna um boolean - verificar se foi bem-sucedida
      if (data === false) {
        // Tentar verificar logs de segurança para entender o motivo (pode falhar por RLS)
        let errorMessage = "Não foi possível excluir o perfil.";
        let securityLogs = null;
        
        try {
          const { data: logs, error: logsError } = await supabase
            .from('security_logs')
            .select('action, details, created_at')
            .or('action.eq.unauthorized_admin_delete_attempt,action.eq.admin_delete_user_profile_error')
            .eq('details->>target_user_id', userId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (!logsError && logs) {
            securityLogs = logs;
            if (logs.action === 'unauthorized_admin_delete_attempt') {
              errorMessage = "Você não tem permissões de administrador para excluir este perfil. Verifique se sua conta tem a role de admin na tabela user_roles.";
            } else if (logs.action === 'admin_delete_user_profile_error' && logs.details && typeof logs.details === 'object' && 'error' in logs.details) {
              errorMessage = `Erro ao excluir: ${(logs.details as any).error}`;
            }
          }
        } catch (logsErr) {
          // Ignorar erro ao consultar logs - não é crítico
          logError('Failed to query security_logs', logsErr, 'ADMIN');
        }

        // Se não conseguiu identificar o motivo específico, usar mensagem genérica baseada na verificação prévia
        if (!securityLogs) {
          // Já verificamos permissões antes, então se chegou aqui pode ser outro problema
          errorMessage = "Não foi possível excluir o perfil. Possíveis causas: o usuário não existe mais, há dependências no banco de dados, ou ocorreu um erro interno. Verifique os logs do servidor.";
        }

        logError('admin_delete_user_profile returned false', { 
          userId, 
          securityLog: securityLogs,
          hasAdminRole: !!roleData,
          targetUserExists: !!targetUser
        }, 'ADMIN');
        
        toast({
          title: "Erro ao excluir perfil",
          description: errorMessage,
          variant: "destructive"
        });
        return;
      }

      toast({
        title: "Perfil excluído",
        description: `O perfil de ${userName} foi excluído com sucesso.`
      });

      if (onSuccess) onSuccess();
    } catch (error: any) {
      logError('Error deleting user profile', error, 'ADMIN');
      toast({
        title: "Erro ao excluir perfil",
        description: error.message || "Não foi possível excluir o perfil do usuário.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
      setShowDeleteProfile(false);
    }
  };

  return (
    <div className="flex gap-2">
      {concursoId && (
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDeleteFromRanking(true)}
            className="text-red-600 hover:text-red-700"
          >
            <UserX className="h-4 w-4 mr-1" />
            Remover do Ranking
          </Button>

          <AlertDialog open={showDeleteFromRanking} onOpenChange={setShowDeleteFromRanking}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remover usuário do ranking</AlertDialogTitle>
                <AlertDialogDescription>
                  Tem certeza que deseja remover {userName} deste ranking? 
                  Esta ação não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isLoading}>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteFromRanking}
                  disabled={isLoading}
                  className="bg-red-600 hover:bg-red-700"
                >
                  {isLoading ? "Removendo..." : "Sim, remover"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}

      {!showOnlyRankingActions && (
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDeleteProfile(true)}
            className="text-red-600 hover:text-red-700"
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Excluir Perfil
          </Button>

          <AlertDialog open={showDeleteProfile} onOpenChange={setShowDeleteProfile}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir perfil do usuário</AlertDialogTitle>
                <AlertDialogDescription>
                  Tem certeza que deseja excluir o perfil de {userName}? 
                  Esta ação removerá todas as participações em rankings e não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isLoading}>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteProfile}
                  disabled={isLoading}
                  className="bg-red-600 hover:bg-red-700"
                >
                  {isLoading ? "Excluindo..." : "Sim, excluir"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </div>
  );
};
