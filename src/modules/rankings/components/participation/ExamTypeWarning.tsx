import React from 'react';
import { AlertTriangle } from 'lucide-react';
interface ExamTypeWarningProps {
  examType: 'Alternativas' | 'Certo ou Errado';
}
export const ExamTypeWarning: React.FC<ExamTypeWarningProps> = ({
  examType
}) => {
  if (examType === 'Alternativas') {
    return null;
  }
  return null;
};