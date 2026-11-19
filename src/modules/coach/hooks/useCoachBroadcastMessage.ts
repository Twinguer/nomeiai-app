import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { devLog } from '@/utils/productionLogger';
import type { CoachStudentListItem } from './useCoachStudents';

export function useCoachBroadcastMessage(students: CoachStudentListItem[]) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (message: string) => {
      if (!user?.id || students.length === 0) {
        throw new Error('Dados insuficientes para enviar mensagem');
      }

      const notifications = students.map((student) => ({
        user_id: student.student_id,
        type: 'coach_message',
        title: 'Mensagem do Coach',
        message: message.trim(),
        metadata: {
          coach_id: user.id,
          sent_at: new Date().toISOString(),
          is_broadcast: true,
        },
      }));

      const { error } = await supabase.from('notifications').insert(notifications);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: 'Mensagem enviada',
        description: `A mensagem foi enviada com sucesso para ${students.length} aluno(s).`,
      });
      students.forEach((student) => {
        queryClient.invalidateQueries({ queryKey: ['notifications', student.student_id] });
      });
    },
    onError: (error: Error) => {
      devLog.error('Erro ao enviar mensagem:', error);
      toast({
        title: 'Erro ao enviar mensagem',
        description: error.message || 'Não foi possível enviar a mensagem. Tente novamente.',
        variant: 'destructive',
      });
    },
  });
}
