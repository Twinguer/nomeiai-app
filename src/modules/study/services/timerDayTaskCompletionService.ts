import { supabase } from '@/integrations/supabase/client';
import { localStudyDateKey } from '@/modules/study/domain/timerDayTaskProgress';
import { UserStudyService } from '@/services/userStudyService';
import type { UserStudy } from '@/types/userStudy';
import { devLog } from '@/utils/productionLogger';
import {
  buildUpdatedTimerDayTaskCompletions,
  writeTimerDayCompletedTaskIdsToLocalStorage,
  type TimerDayTaskCompletionsByDate,
} from '@/utils/timerDayTaskCompletion';

export async function persistTimerDayTaskCompletions(options: {
  ownerUserId: string;
  cycleId: string;
  taskIds: ReadonlySet<string>;
  dateKey?: string;
}): Promise<boolean> {
  const dateKey = options.dateKey ?? localStudyDateKey();

  writeTimerDayCompletedTaskIdsToLocalStorage(
    options.ownerUserId,
    options.cycleId,
    options.taskIds,
    dateKey
  );

  const { data, error } = await supabase.rpc('patch_timer_day_task_completions', {
    p_user_id: options.ownerUserId,
    p_date_key: dateKey,
    p_cycle_id: options.cycleId,
    p_task_ids: [...options.taskIds],
  });

  if (error || data !== true) {
    devLog.error('persistTimerDayTaskCompletions failed', error ?? { data });
    return false;
  }

  UserStudyService.clearCache(options.ownerUserId);
  return true;
}

export function mergeTimerDayCompletionsIntoUserStudy(
  userStudy: UserStudy,
  cycleId: string,
  taskIds: ReadonlySet<string>,
  dateKey = localStudyDateKey()
): UserStudy {
  return {
    ...userStudy,
    timer_day_task_completions: buildUpdatedTimerDayTaskCompletions(
      userStudy.timer_day_task_completions,
      cycleId,
      taskIds,
      dateKey
    ),
  };
}

export type { TimerDayTaskCompletionsByDate };
