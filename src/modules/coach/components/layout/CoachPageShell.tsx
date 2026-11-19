import React from 'react';
import { Alert } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

export type CoachPageShellState =
  | { kind: 'loading'; message: string }
  | { kind: 'denied'; message: string }
  | { kind: 'ready' };

type CoachPageShellProps = {
  state: CoachPageShellState;
  title?: string;
  subtitle?: string;
  header?: React.ReactNode;
  children?: React.ReactNode;
};

export function CoachPageShell({ state, title, subtitle, header, children }: CoachPageShellProps) {
  if (state.kind === 'loading') {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">{state.message}</div>
      </div>
    );
  }

  if (state.kind === 'denied') {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <p>{state.message}</p>
        </Alert>
      </div>
    );
  }

  return (
    <div className="relative">
      {(header || title) && (
        <div className="sticky top-0 z-10 bg-background border-b mb-4 p-4">
          {header ?? (
            <div>
              {title ? <h1 className="text-2xl font-bold">{title}</h1> : null}
              {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
            </div>
          )}
        </div>
      )}
      {children}
    </div>
  );
}

export function resolveCoachGateShellState(input: {
  isValidatingToken: boolean;
  validatedStudentId: string | null;
  isCheckingAccess: boolean;
  hasAccess: boolean;
  accessDeniedMessage: string;
  requiresCycle?: boolean;
  isResolvingCycleToken?: boolean;
  isCycleReady?: boolean;
}): CoachPageShellState {
  if (input.isValidatingToken || !input.validatedStudentId) {
    return { kind: 'loading', message: 'Validando acesso...' };
  }
  if (input.isCheckingAccess) {
    return { kind: 'loading', message: 'Verificando acesso...' };
  }
  if (!input.hasAccess) {
    return { kind: 'denied', message: input.accessDeniedMessage };
  }
  if (
    input.requiresCycle &&
    (input.isResolvingCycleToken || !input.isCycleReady)
  ) {
    return { kind: 'loading', message: 'Validando ciclo de estudos...' };
  }
  return { kind: 'ready' };
}
