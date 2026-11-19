import React from 'react';
import Cronograma from '@/modules/study/pages/Cronograma';
import { CoachStudyPageWrapper } from '@/modules/coach/components/layout/CoachStudyPageWrapper';

const StudentSchedulePage = () => (
  <CoachStudyPageWrapper
    title="Cronograma de Estudos"
    subtitlePrefix="Cronograma de:"
    requiresCycle
  >
    {({ studentId, cycleId, navigateToStudent }) => (
      <Cronograma
        coachMode
        targetStudentId={studentId}
        targetCycleId={cycleId}
        onSuccess={() => navigateToStudent()}
      />
    )}
  </CoachStudyPageWrapper>
);

export default StudentSchedulePage;
