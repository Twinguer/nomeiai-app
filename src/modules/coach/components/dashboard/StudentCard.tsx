import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Clock, CheckCircle, Eye, Trash2 } from 'lucide-react';
import { getAvatarUrl } from '@/utils/avatarUtils';
import { formatLocalDatePtBr } from '@/utils/dateFormat';
import { formatHoursDisplay } from '@/utils/formatHours';
import type { CoachStudentListItem } from '../../hooks/useCoachStudents';
import { getCoachInitials } from '../layout/coachUtils';

type StudentCardProps = {
  student: CoachStudentListItem;
  onView: (studentId: string) => void;
  onRemove: (studentId: string, studentEmail: string) => void;
  isRemoving?: boolean;
};

export function StudentCard({ student, onView, onRemove, isRemoving }: StudentCardProps) {
  const avatarUrl = getAvatarUrl(student.avatar_url);
  const displayName =
    student.student_name ||
    student.student_email ||
    'Aluno #' + student.student_id.slice(0, 8);

  return (
    <Card
      className="bg-primary/5 border-primary/20 hover:shadow-lg transition-all duration-200"
      style={{
        boxShadow:
          '0 8px 25px rgba(0, 0, 0, 0.15), 0 4px 10px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.05)',
      }}
    >
      <CardContent className="p-5 flex flex-col">
        <div className="flex flex-col items-center mb-4">
          <div className="relative mb-3">
            <Avatar
              className="h-20 w-20 border-2 border-primary/20"
              style={{ boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)' }}
            >
              <AvatarImage src={avatarUrl} alt={displayName} />
              <AvatarFallback className="bg-gradient-to-br from-purple-500 to-blue-500 text-white font-bold text-lg">
                {getCoachInitials(student.student_name || student.student_email || '')}
              </AvatarFallback>
            </Avatar>
            <Badge
              variant={student.status === 'active' ? 'default' : 'secondary'}
              className="absolute -bottom-1 -right-1"
            >
              {student.status === 'active' ? 'Ativo' : 'Inativo'}
            </Badge>
          </div>
          <h3 className="font-semibold text-base text-center leading-tight">{displayName}</h3>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4 border-t border-b py-3">
          <div className="flex flex-col items-center">
            <Clock className="h-4 w-4 text-muted-foreground mb-1" />
            <span className="text-lg font-bold text-primary">
              {formatHoursDisplay(student.performance.hours_this_week || 0)}
            </span>
            <span className="text-xs text-muted-foreground text-center">Últimos 7 dias</span>
          </div>
          <div className="flex flex-col items-center">
            <CheckCircle className="h-4 w-4 text-muted-foreground mb-1" />
            <span className="text-lg font-bold text-green-600">
              {student.performance.tasks_completed || 0}
            </span>
            <span className="text-xs text-muted-foreground text-center">Tarefas (7 dias)</span>
          </div>
        </div>

        {student.last_activity ? (
          <div className="mb-4 text-center">
            <p className="text-xs text-muted-foreground">Última atividade:</p>
            <p className="text-xs font-medium">{formatLocalDatePtBr(student.last_activity)}</p>
          </div>
        ) : null}

        <div className="flex flex-col gap-2 mt-auto">
          <Button
            variant="default"
            size="sm"
            onClick={() => onView(student.student_id)}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white dark:bg-purple-500 dark:hover:bg-purple-600"
          >
            <Eye className="mr-2 h-4 w-4" />
            Ver Detalhes
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onRemove(student.student_id, student.student_email || 'aluno');
            }}
            className="w-full text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300 hover:text-red-700"
            disabled={isRemoving}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Remover
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
