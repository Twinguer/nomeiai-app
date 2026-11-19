import React from 'react';
import CicloDetalhes from '@/modules/study/pages/CicloDetalhes';
import { CoachStudyPageWrapper } from '@/modules/coach/components/layout/CoachStudyPageWrapper';

const StudentCycleDisciplinesPage = () => (
  <CoachStudyPageWrapper
    title="Disciplinas do Ciclo"
    subtitlePrefix="Visualizando disciplinas de:"
    requiresCycle
  >
    {({ studentId, cycleId }) => (
      <CicloDetalhes cycleId={cycleId!} coachMode targetStudentId={studentId} />
    )}
  </CoachStudyPageWrapper>
);

export default StudentCycleDisciplinesPage;
