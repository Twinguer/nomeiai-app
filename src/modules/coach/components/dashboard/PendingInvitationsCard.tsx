import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Trash2 } from 'lucide-react';
import { getAvatarUrl } from '@/utils/avatarUtils';
import type { CoachPendingInvitation } from '../../services/coachInvitationService';
import { getCoachInitials } from '../layout/coachUtils';

type PendingInvitationsCardProps = {
  invitations: CoachPendingInvitation[];
  onCancel: (invitationId: string) => void;
  isCancelling?: boolean;
};

export function PendingInvitationsCard({
  invitations,
  onCancel,
  isCancelling,
}: PendingInvitationsCardProps) {
  if (invitations.length === 0) return null;

  return (
    <Card className="bg-primary/5 border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Convites Pendentes</CardTitle>
          <Badge variant="outline" className="bg-primary/10 border-primary/20">
            {invitations.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2">
          {invitations.map((invitation) => (
            <div
              key={invitation.id}
              className="flex items-center justify-between p-2 bg-card rounded-lg border border-border"
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <Avatar className="h-8 w-8 flex-shrink-0">
                  <AvatarImage src={getAvatarUrl(invitation.student_avatar)} />
                  <AvatarFallback className="text-xs">
                    {getCoachInitials(
                      invitation.student_name || invitation.student_email || 'A'
                    )}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {invitation.student_name ||
                      invitation.student_email ||
                      'Aluno desconhecido'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(invitation.invited_at).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (confirm('Tem certeza que deseja cancelar este convite?')) {
                    onCancel(invitation.id);
                  }
                }}
                disabled={isCancelling}
                className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 px-2"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
