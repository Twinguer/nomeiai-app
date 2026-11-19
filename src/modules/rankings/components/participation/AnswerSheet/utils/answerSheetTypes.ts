import { Concurso, SectionType } from '@/types/concursos';

// Tipos específicos do AnswerSheet
export interface AnswerSheetProps {
  concurso: Concurso;
  rankingId: string;
  onSuccess: () => void;
}

export interface AnswerSheetState {
  selectedSection: SectionType;
  isSaving: boolean;
  error: string | null;
  savedSuccess: boolean;
  selectedBookletId: string;
  nullifiedQuestions: Set<number>;
  lastCheckedNullifiedCount: number;
  sectionLabels: Record<string, string>;
  missingOfficialAnswers: boolean;
  checkingOfficialAnswers: boolean;
  subjectScores: Record<string, number>;
}

export interface AnswerSheetData {
  userRankingData: any;
  examBooklets: any[];
  nullifiedData: any[];
  sectionQuestions: any;
  questionOptions: Record<number, string[]>;
  isHierarchical: boolean;
}

export interface AnswerSheetValidation {
  canEdit: boolean;
  editsLeft: number;
  totalQuestions: number;
  answeredQuestions: number;
  progressPercentage: number;
  hasNullifiedQuestions: boolean;
}

export interface AnswerSheetActions {
  handleSaveAnswers: () => Promise<void>;
  handleBookletChanged: (newBookletId: string, newAnswers: Record<number, string>) => Promise<void>;
  handleSectionChange: (value: string) => void;
  handleScoreChange: (value: string, setter: React.Dispatch<React.SetStateAction<number | null>>, scoreName: string) => void;
  handleSubjectScoreChange: (key: string, value: number) => void;
  clearAllAnswers: () => void;
}

export interface ObjectiveSection {
  key: string;
  label: string;
}

export interface AnswerSheetProgress {
  totalQuestions: number;
  answeredQuestions: number;
  progressPercentage: number;
  hasNullifiedQuestions: boolean;
  nullifiedQuestions: Set<number>;
}

export interface AnswerSheetAlert {
  type: 'error' | 'success' | 'warning' | 'info';
  message: string;
  details?: string;
  show: boolean;
}

export interface BookletInfo {
  id: string;
  name: string;
  displayOrder: number;
}

export interface AnswerSheetTabsProps {
  objectiveSections: ObjectiveSection[];
  selectedSection: SectionType;
  onSectionChange: (value: string) => void;
  shouldShowSubjective: boolean;
  concurso: Concurso;
}

export interface AnswerSheetMatrixProps {
  matrix: any[];
  answers: Record<number, string>;
  onAnswerChange: (questionNumber: number, answer: string) => void;
  onClearAnswer: (questionNumber: number) => void;
  getOptionsForQuestion: (questionNumber: number) => string[];
  disabled: boolean;
  examType: 'Alternativas' | 'Certo ou Errado';
  nullifiedQuestions: Set<number>;
}

export interface AnswerSheetSubjectiveProps {
  concurso: Concurso;
  subjectScores: Record<string, number>;
  onSubjectScoreChange: (key: string, value: number) => void;
  canEdit: boolean;
}

export interface AnswerSheetActionsProps {
  onSave: () => Promise<void>;
  isSaving: boolean;
  canEdit: boolean;
  editCount?: number;
  disabled?: boolean;
}

export interface AnswerSheetAlertsProps {
  error: string | null;
  savedSuccess: boolean;
  missingOfficialAnswers: boolean;
  nullifiedQuestions: Set<number>;
  onDismissError: () => void;
  onDismissSuccess: () => void;
}



