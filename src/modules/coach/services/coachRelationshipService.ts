import { supabase } from '@/integrations/supabase/client';
import type { CoachProfile, ConsentData, StudentRelationship } from '../domain/types';

export const coachRelationshipService = {
  async getCoachProfile(coachId: string): Promise<CoachProfile | null> {
    const { data, error } = await supabase
      .from('coach_profiles')
      .select('*')
      .eq('coach_id', coachId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  async getStudents(coachId: string): Promise<StudentRelationship[]> {
    const profile = await this.getCoachProfile(coachId);
    return profile?.student_relationships || [];
  },

  async addStudent(
    coachId: string,
    studentId: string,
    consentData: ConsentData
  ): Promise<StudentRelationship> {
    const { data, error } = await supabase.rpc('add_student_to_coach', {
      p_coach_id: coachId,
      p_student_id: studentId,
      p_consent_data: consentData,
    });

    if (error) throw error;
    return data;
  },

  async removeStudent(coachId: string, studentId: string): Promise<void> {
    const { error } = await supabase.rpc('remove_student_from_coach', {
      p_coach_id: coachId,
      p_student_id: studentId,
    });

    if (error) throw error;
  },

  async getStudentData(coachId: string, studentId: string): Promise<StudentRelationship | null> {
    const students = await this.getStudents(coachId);
    return students.find((s) => s.student_id === studentId) || null;
  },
};
