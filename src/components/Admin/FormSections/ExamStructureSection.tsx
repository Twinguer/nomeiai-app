
import React from 'react';
import { UseFormReturn } from 'react-hook-form';
import { ExamStructureSectionComponent } from '../CreateRanking/ExamStructureSection';
import { MinimumScoreSection } from '../CreateRanking/MinimumScoreSection';

interface ExamStructureSectionProps {
  form: UseFormReturn<any>;
}

export const ExamStructureSection: React.FC<ExamStructureSectionProps> = ({ form }) => {
  return (
    <>
      <MinimumScoreSection form={form} />
      <ExamStructureSectionComponent form={form} />
    </>
  );
};
