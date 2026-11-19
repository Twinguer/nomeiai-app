import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { coachAccessService } from '@/modules/coach';
import { UserUrlObfuscationService } from '@/services/userUrlObfuscation';
import { devLog } from '@/utils/productionLogger';

type UseCoachStudentGateOptions = {
  studentIdParam?: string;
  cycleIdParam?: string;
  redirectOnDeny?: string;
};

async function resolveCoachCycleIdFromToken(
  cycleTokenParam: string,
  studentUserId: string
): Promise<string | null> {
  const { StudyCycleUrlObfuscationService } = await import('@/services/studyCycleUrlObfuscation');
  return StudyCycleUrlObfuscationService.validateStudyCycleToken(cycleTokenParam, studentUserId);
}

/**
 * Valida token do aluno (URL), acesso coach via RPC, e opcionalmente token do ciclo (após acesso).
 */
export function useCoachStudentGate({
  studentIdParam,
  cycleIdParam,
  redirectOnDeny = '/coach/dashboard',
}: UseCoachStudentGateOptions) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [validatedStudentId, setValidatedStudentId] = useState<string | null>(null);
  const [validatedCycleId, setValidatedCycleId] = useState<string | null>(null);
  const [isValidatingStudentToken, setIsValidatingStudentToken] = useState(false);
  const [isResolvingCycleToken, setIsResolvingCycleToken] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);

  // Fase 1: apenas token do aluno na URL
  useEffect(() => {
    const validateStudent = async () => {
      if (!studentIdParam) return;

      setIsValidatingStudentToken(true);
      setTokenError(null);
      setValidatedStudentId(null);
      setValidatedCycleId(null);

      try {
        const validatedUserId = await UserUrlObfuscationService.validateUserToken(studentIdParam);
        if (!validatedUserId) {
          throw new Error('Token de aluno inválido');
        }
        setValidatedStudentId(validatedUserId);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Token de acesso inválido ou expirado';
        devLog.error('[useCoachStudentGate] Erro ao validar token do aluno:', error);
        setTokenError(message);
        toast({
          title: 'Erro',
          description: message,
          variant: 'destructive',
        });
        navigate(redirectOnDeny);
      } finally {
        setIsValidatingStudentToken(false);
      }
    };

    validateStudent();
  }, [studentIdParam, navigate, toast, redirectOnDeny]);

  const accessQuery = useQuery({
    queryKey: ['coach-has-access', 'v3', user?.id, validatedStudentId],
    queryFn: async () => {
      if (!user?.id || !validatedStudentId) return null;
      return coachAccessService.checkHasStudentAccess(user.id, validatedStudentId);
    },
    enabled: !!user?.id && !!validatedStudentId && !tokenError,
    retry: false,
  });

  const hasAccess = accessQuery.data?.allowed === true && !accessQuery.isError;
  const isCheckingAccess =
    !tokenError &&
    !!validatedStudentId &&
    (accessQuery.isLoading || accessQuery.isFetching);

  // Fase 1 (continuação): token do ciclo só após acesso coach confirmado
  useEffect(() => {
    if (!cycleIdParam || !validatedStudentId || !hasAccess || tokenError) {
      if (!cycleIdParam) {
        setValidatedCycleId(null);
      }
      return;
    }

    let cancelled = false;

    const resolveCycle = async () => {
      setIsResolvingCycleToken(true);
      try {
        const cycleId = await resolveCoachCycleIdFromToken(cycleIdParam, validatedStudentId);
        if (!cycleId) {
          throw new Error('Token de ciclo inválido ou expirado');
        }
        if (!cancelled) {
          setValidatedCycleId(cycleId);
        }
      } catch (error) {
        if (cancelled) return;
        const message =
          error instanceof Error ? error.message : 'Token de ciclo inválido ou expirado';
        devLog.error('[useCoachStudentGate] Erro ao validar token do ciclo:', error);
        setTokenError(message);
        toast({
          title: 'Erro',
          description: message,
          variant: 'destructive',
        });
        navigate(redirectOnDeny);
      } finally {
        if (!cancelled) {
          setIsResolvingCycleToken(false);
        }
      }
    };

    resolveCycle();

    return () => {
      cancelled = true;
    };
  }, [
    cycleIdParam,
    validatedStudentId,
    hasAccess,
    tokenError,
    navigate,
    toast,
    redirectOnDeny,
  ]);

  const displayQuery = useQuery({
    queryKey: ['coach-student-display', validatedStudentId],
    queryFn: async () => {
      if (!validatedStudentId) return null;
      return coachAccessService.getStudentDisplay(validatedStudentId);
    },
    enabled: !!validatedStudentId && hasAccess,
    retry: 1,
  });

  useEffect(() => {
    if (accessQuery.isError && validatedStudentId && !isValidatingStudentToken) {
      toast({
        title: 'Erro de acesso',
        description: 'Não foi possível validar o acesso ao aluno. Tente recarregar a página.',
        variant: 'destructive',
      });
      navigate(redirectOnDeny);
    }
  }, [
    accessQuery.isError,
    validatedStudentId,
    isValidatingStudentToken,
    navigate,
    toast,
    redirectOnDeny,
  ]);

  const displayName =
    displayQuery.data?.success && displayQuery.data.display_name
      ? displayQuery.data.display_name
      : 'seu aluno';

  const navigateToStudent = async () => {
    if (!validatedStudentId) {
      navigate(redirectOnDeny);
      return;
    }
    try {
      const studentToken = await UserUrlObfuscationService.generateUserToken(validatedStudentId);
      navigate(`/coach/student/${studentToken}`);
    } catch (error) {
      devLog.error('[useCoachStudentGate] Erro ao gerar URL do aluno:', error);
      navigate(redirectOnDeny);
    }
  };

  const needsCycle = !!cycleIdParam;
  const isValidatingToken = isValidatingStudentToken;
  const isCycleReady = !needsCycle || (!!validatedCycleId && !isResolvingCycleToken);

  return {
    user,
    validatedStudentId,
    validatedCycleId,
    isValidatingToken,
    isResolvingCycleToken,
    isCycleReady,
    hasAccess,
    isCheckingAccess,
    accessDeniedMessage:
      accessQuery.data?.message ??
      'Você não tem acesso a este aluno ou o aluno não faz parte da sua equipe',
    displayName,
    avatarUrl: displayQuery.data?.avatar_url ?? null,
    isLoadingDisplay: displayQuery.isLoading,
    navigateToStudent,
  };
}
