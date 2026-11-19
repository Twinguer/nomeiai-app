import React from 'react';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle } from 'lucide-react';
import type { CanInviteResponse } from '../../domain/types';

type TeamStatsStripProps = {
  activeStudents: number;
  inactiveCount: number;
  canInvite?: CanInviteResponse;
};

export function TeamStatsStrip({
  activeStudents,
  inactiveCount,
  canInvite,
}: TeamStatsStripProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card className="bg-primary/5 border-primary/20">
        <CardHeader>
          <CardDescription>Total de Alunos</CardDescription>
          <CardTitle className="text-4xl font-bold">{activeStudents}</CardTitle>
          {canInvite ? (
            <Badge variant="secondary">
              {canInvite.current}/{canInvite.max}
            </Badge>
          ) : null}
        </CardHeader>
      </Card>

      <Card className={inactiveCount > 0 ? 'border-red-500/20 bg-red-500/5' : ''}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardDescription>Avisos</CardDescription>
            <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
          </div>
          <CardTitle className="text-4xl font-bold">{inactiveCount}</CardTitle>
          <CardDescription className="text-xs mt-2">
            {inactiveCount > 0
              ? 'aluno(s) sem atividade nos últimos 7 dias'
              : 'Nenhum aviso'}
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
