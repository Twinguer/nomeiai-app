import { supabase } from '@/integrations/supabase/client';
import { UserStudyService } from '@/services/userStudyService';
import { getLastStudyActivityDate } from '@/utils/userStudyHelpers';
import { coachAccessService } from './coachAccessService';
import { coachRelationshipService } from './coachRelationshipService';
import { computeCoachStudentPerformanceFromStudyData } from '../domain/studentPerformance';
import type { StudentRelationship } from '../domain/types';

export type CoachStudentListItem = StudentRelationship & {
  student_name: string;
  avatar_url?: string | null;
};

export type CoachStudentDetails = StudentRelationship & {
  student_name: string;
  studyData?: Record<string, unknown> | null;
};

export async function fetchCoachStudentsWithDetails(
  coachId: string
): Promise<CoachStudentListItem[]> {
  const studentList = await coachRelationshipService.getStudents(coachId);

  return Promise.all(
    studentList.map(async (student) => {
      const { data: userData } = await supabase
        .from('users_profiles')
        .select('name, email, avatar_url')
        .eq('id', student.student_id)
        .single();

      const studyData = await UserStudyService.getUserStudyData(student.student_id);
      const realPerformance = computeCoachStudentPerformanceFromStudyData(studyData);

      return {
        ...student,
        student_name:
          userData?.name ||
          userData?.email?.split('@')[0] ||
          'Aluno #' + student.student_id.slice(0, 8),
        student_email: student.student_email || userData?.email,
        avatar_url: userData?.avatar_url,
        last_activity: realPerformance.last_activity ?? student.last_activity,
        performance: {
          ...student.performance,
          ...realPerformance,
        },
      };
    })
  );
}

export async function fetchCoachStudentDetails(
  coachId: string,
  studentId: string
): Promise<CoachStudentDetails | null> {
  const studentData = await coachRelationshipService.getStudentData(coachId, studentId);
  if (!studentData) return null;

  const display = await coachAccessService.getStudentDisplay(studentId);

  const { data: studyData } = await supabase
    .from('user_study_v2')
    .select('*')
    .eq('user_id', studentId)
    .single();

  const lastActivityFromStudy = studyData
    ? getLastStudyActivityDate({
        last_activity_date: studyData.last_activity_date,
        study_sessions: studyData.study_sessions,
        study_schedule: studyData.study_schedule,
        study_statistics: studyData.study_statistics,
      })
    : null;

  return {
    ...studentData,
    student_name: display.success && display.display_name ? display.display_name : 'Aluno',
    last_activity: lastActivityFromStudy ?? studentData.last_activity,
    studyData: studyData ?? null,
  };
}
