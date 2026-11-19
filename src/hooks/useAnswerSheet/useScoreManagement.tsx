
import { useState } from 'react';

export const useScoreManagement = () => {
  // Manter compatibilidade com campos diretos para transição gradual
  const [discursiveScore, setDiscursiveScore] = useState<number | null>(null);
  const [caseStudy1Score, setCaseStudy1Score] = useState<number | null>(null);
  const [caseStudy2Score, setCaseStudy2Score] = useState<number | null>(null);
  const [caseStudy3Score, setCaseStudy3Score] = useState<number | null>(null);
  const [otherSubjectiveScore, setOtherSubjectiveScore] = useState<number | null>(null);

  return {
    discursiveScore,
    setDiscursiveScore,
    caseStudy1Score,
    setCaseStudy1Score,
    caseStudy2Score,
    setCaseStudy2Score,
    caseStudy3Score,
    setCaseStudy3Score,
    otherSubjectiveScore,
    setOtherSubjectiveScore
  };
};
