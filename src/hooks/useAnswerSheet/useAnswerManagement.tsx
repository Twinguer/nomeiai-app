
import { useState } from 'react';

interface UseAnswerManagementResult {
  answers: { [key: number]: string };
  setAnswers: React.Dispatch<React.SetStateAction<{ [key: number]: string }>>;
  handleAnswerChange: (questionNumber: number, answer: string) => void;
  handleClearAnswer: (questionNumber: number) => void;
  clearAllAnswers: () => void;
}

export const useAnswerManagement = (): UseAnswerManagementResult => {
  const [answers, setAnswers] = useState<{ [key: number]: string }>({});

  const handleAnswerChange = (questionNumber: number, answer: string) => {
    // Debug logs removed for security
    setAnswers((prev) => {
      const newAnswers = {
        ...prev,
        [questionNumber]: answer
      };
      // Debug logs removed for security
      return newAnswers;
    });
  };

  const handleClearAnswer = (questionNumber: number) => {
    // Debug logs removed for security
    setAnswers((prev) => {
      const newAnswers = { ...prev };
      delete newAnswers[questionNumber];
      // Debug logs removed for security
      return newAnswers;
    });
  };

  const clearAllAnswers = () => {
    // Debug logs removed for security
    setAnswers({});
  };

  return {
    answers,
    setAnswers,
    handleAnswerChange,
    handleClearAnswer,
    clearAllAnswers
  };
};
