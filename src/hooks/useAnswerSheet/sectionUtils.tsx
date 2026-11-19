
import { Concurso, SectionType } from '@/types/concursos';
import { devLog, sanitizeForLog } from '@/utils/productionLogger';

export const handleQuestionSectionSelection = (
  concurso: Concurso, 
  setSelectedSection: React.Dispatch<React.SetStateAction<SectionType>>
) => {
  if (!concurso) return;
  
  // Always use disciplines structure (new system)
  if (concurso.disciplines && Array.isArray(concurso.disciplines)) {
    devLog.log('[handleQuestionSectionSelection] Usando estrutura de disciplinas');
    
    // Selecionar primeira disciplina habilitada
    let foundSection = false;
    
    // Checar se estrutura é hierárquica
    const isHierarchical = concurso.disciplines.length > 0 && 'disciplines' in concurso.disciplines[0];
    
    if (isHierarchical) {
      // Estrutura hierárquica (blocos -> disciplinas)
      for (const block of concurso.disciplines) {
        if ('disciplines' in block) {
          for (const discipline of block.disciplines) {
            if (discipline.isEnabled && discipline.type) {
              setSelectedSection(discipline.type as SectionType);
              foundSection = true;
              break;
            }
          }
          if (foundSection) break;
        }
      }
    } else {
      // Estrutura plana
      for (const discipline of concurso.disciplines) {
        if ('isEnabled' in discipline && discipline.isEnabled && discipline.type) {
          setSelectedSection(discipline.type as SectionType);
          foundSection = true;
          break;
        }
      }
    }
    
    if (!foundSection) {
      devLog.warn('[handleQuestionSectionSelection] No enabled disciplines found');
    }
  } else {
    // Debug logs removed for security
  }
};
