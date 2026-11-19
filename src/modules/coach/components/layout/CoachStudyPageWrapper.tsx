import React from 'react';
import { useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCoachStudentGate } from '../../hooks/useCoachStudentGate';
import { CoachPageShell, resolveCoachGateShellState } from './CoachPageShell';

type CoachStudyPageWrapperProps = {
  title: string;
  subtitlePrefix: string;
  requiresCycle?: boolean;
  children: (ctx: {
    studentId: string;
    cycleId?: string;
    navigateToStudent: () => void;
  }) => React.ReactNode;
};

export function CoachStudyPageWrapper({
  title,
  subtitlePrefix,
  requiresCycle = false,
  children,
}: CoachStudyPageWrapperProps) {
  const { studentId: studentIdParam, cycleId: cycleIdParam } = useParams();
  const gate = useCoachStudentGate({ studentIdParam, cycleIdParam });

  const shellState = resolveCoachGateShellState({
    isValidatingToken: gate.isValidatingToken,
    validatedStudentId: gate.validatedStudentId,
    isCheckingAccess: gate.isCheckingAccess,
    hasAccess: gate.hasAccess,
    accessDeniedMessage: gate.accessDeniedMessage,
    requiresCycle,
    isResolvingCycleToken: gate.isResolvingCycleToken,
    isCycleReady: gate.isCycleReady,
  });

  if (shellState.kind !== 'ready' || !gate.validatedStudentId) {
    return <CoachPageShell state={shellState} />;
  }

  if (requiresCycle && !gate.validatedCycleId) {
    return (
      <CoachPageShell
        state={{ kind: 'loading', message: 'Validando ciclo de estudos...' }}
      />
    );
  }

  const subtitle = (
    <>
      {subtitlePrefix}{' '}
      <span className="font-semibold text-foreground">{gate.displayName}</span>
    </>
  );

  const header = (
    <div className="flex items-center gap-4">
      <Button variant="ghost" size="icon" onClick={() => gate.navigateToStudent()}>
        <ArrowLeft className="h-4 w-4" />
      </Button>
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );

  return (
    <CoachPageShell state={{ kind: 'ready' }} header={header}>
      {children({
        studentId: gate.validatedStudentId,
        cycleId: gate.validatedCycleId ?? undefined,
        navigateToStudent: gate.navigateToStudent,
      })}
    </CoachPageShell>
  );
}
