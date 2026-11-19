
import { Concurso } from '@/types/concursos';

export interface UseSaveAnswersProps {
  rankingId: string;
  concurso: Concurso;
  answers: { [key: number]: string };
  setIsSaving: (saving: boolean) => void;
  setError: (error: string | null) => void;
  setSavedSuccess: (success: boolean) => void;
  onSuccess: () => void;
  discursiveScore?: number | null;
  caseStudy1Score?: number | null;
  caseStudy2Score?: number | null;
  caseStudy3Score?: number | null;
  subjectScores?: Record<string, number>;
  editCount: number;
  nullifiedQuestions?: Set<number>;
  selectedBookletId?: string;
  setSelectedBookletId?: (bookletId: string) => void;
}

export interface SaveAnswersResponse {
  success: boolean;
  edit_count: number;
  booklet_key: string;
  answers_saved: number;
  total_score: number;
  message: string;
  saved_answers: { [key: string]: string };
}
