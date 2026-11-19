import React from 'react';
import CriarCiclo from '@/modules/study/pages/CriarCiclo';
import { CoachStudyPageWrapper } from '@/modules/coach/components/layout/CoachStudyPageWrapper';

const CreateCycleForStudent = () => (
  <CoachStudyPageWrapper title="Criar Ciclo de Estudo" subtitlePrefix="Criando ciclo para:">
    {({ studentId, navigateToStudent }) => (
      <CriarCiclo
        coachMode
        targetStudentId={studentId}
        onSuccess={() => navigateToStudent()}
      />
    )}
  </CoachStudyPageWrapper>
);

export default CreateCycleForStudent;
