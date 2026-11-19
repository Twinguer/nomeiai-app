
export interface AnswerKeyData {
  questionNumber: number;
  correctAnswer: string;
  weight: number;
  isNullified: boolean;
  sectionType: string;
}

export interface ConsolidatedAnswerKey {
  booklets: {
    [bookletId: string]: {
      answers: { [questionNumber: string]: any };
      metadata: {
        completed_at: string;
        answer_count: number;
        booklet_name?: string;
      };
    };
  };
  metadata: {
    last_updated: string;
    version: string;
  };
}

export interface AnswerKeyCompleteness {
  allComplete: boolean;
  details: Array<{
    bookletId: string;
    bookletName: string;
    completed: number;
    total: number;
    isComplete: boolean;
  }>;
}

export interface AnswerKeyStats {
  totalBooklets: number;
  totalAnswers: number;
  lastUpdated: string | null;
}
