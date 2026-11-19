import { supabase } from '@/integrations/supabase/client';
import type { CoachTask } from '../domain/types';

export const coachTaskService = {
  async getTasks(coachId: string): Promise<CoachTask[]> {
    const { data, error } = await supabase
      .from('coach_profiles')
      .select('coach_tasks')
      .eq('coach_id', coachId)
      .single();

    if (error) throw error;
    return data?.coach_tasks || [];
  },

  async getStudentTasks(coachId: string, studentId: string): Promise<CoachTask[]> {
    const tasks = await this.getTasks(coachId);
    return tasks.filter((task) => task.student_id === studentId);
  },

  async createTask(
    coachId: string,
    task: Omit<CoachTask, 'task_id' | 'created_at'>
  ): Promise<void> {
    const tasks = await this.getTasks(coachId);

    const newTask: CoachTask = {
      ...task,
      task_id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
    };

    tasks.push(newTask);

    const { error } = await supabase
      .from('coach_profiles')
      .update({ coach_tasks: tasks })
      .eq('coach_id', coachId);

    if (error) throw error;
  },

  async updateTaskStatus(
    coachId: string,
    taskId: string,
    status: CoachTask['status']
  ): Promise<void> {
    const tasks = await this.getTasks(coachId);
    const updatedTasks = tasks.map((task) =>
      task.task_id === taskId
        ? {
            ...task,
            status,
            completed_at:
              status === 'completed' ? new Date().toISOString() : task.completed_at,
          }
        : task
    );

    const { error } = await supabase
      .from('coach_profiles')
      .update({ coach_tasks: updatedTasks })
      .eq('coach_id', coachId);

    if (error) throw error;
  },
};
