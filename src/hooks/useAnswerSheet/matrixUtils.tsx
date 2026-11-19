
import { Concurso, SectionType, isDisciplineBlock } from '@/types/concursos';
import { devLog, sanitizeForLog } from '@/utils/productionLogger';

// Type for storing questions by section
export type SectionQuestions = {
  [key: string]: number[];
};

// Get a dictionary of sections with their corresponding question numbers
export const getSectionQuestionsDict = (concurso: Concurso): SectionQuestions => {
  const result: SectionQuestions = {};

  if (!concurso) return result;

  // Verificar se é a nova estrutura hierárquica (objeto com blocks)
  if (concurso.disciplines && typeof concurso.disciplines === 'object' && !Array.isArray(concurso.disciplines) && concurso.disciplines.blocks) {
    // Debug logs removed for security
    
    let currentQuestionNumber = 1;
    
    // Processar blocos da nova estrutura
    for (const block of concurso.disciplines.blocks) {
      if (block.disciplines && Array.isArray(block.disciplines)) {
        for (const discipline of block.disciplines) {
          if (discipline.isEnabled && discipline.type) {
            // Create array for this discipline if it doesn't exist
            if (!result[discipline.type]) {
              result[discipline.type] = [];
            }

            // Add question numbers for this discipline
            const questionCount = parseInt(String(discipline.questionCount), 10) || 0;
            // Debug logs removed for security
            for (let i = 0; i < questionCount; i++) {
              result[discipline.type].push(currentQuestionNumber);
              currentQuestionNumber++;
            }
          }
        }
      }
    }
  }
  // Verificar se é array (estrutura antiga)
  else if (concurso.disciplines && Array.isArray(concurso.disciplines)) {
    devLog.log('[getSectionQuestionsDict] Using disciplines array structure');
    
    // Check if hierarchical (blocks -> disciplines)
    const isHierarchical = concurso.disciplines.length > 0 && 
                           isDisciplineBlock(concurso.disciplines[0]);

    let currentQuestionNumber = 1;

    if (isHierarchical) {
      // Process hierarchical structure
      for (const block of concurso.disciplines) {
        if (isDisciplineBlock(block)) {
          // Process each discipline in the block
          for (const discipline of block.disciplines) {
            if (discipline.isEnabled && discipline.type) {
              // Create array for this discipline if it doesn't exist
              if (!result[discipline.type]) {
                result[discipline.type] = [];
              }

              // Add question numbers for this discipline
              const questionCount = parseInt(String(discipline.questionCount), 10) || 0;
              for (let i = 0; i < questionCount; i++) {
                result[discipline.type].push(currentQuestionNumber);
                currentQuestionNumber++;
              }
            }
          }
        }
      }
    } else {
      // Process flat structure
      for (const discipline of concurso.disciplines) {
        if ('isEnabled' in discipline && discipline.isEnabled && discipline.type) {
          // Create array for this discipline if it doesn't exist
          if (!result[discipline.type]) {
            result[discipline.type] = [];
          }

          // Add question numbers for this discipline
          const questionCount = parseInt(String(discipline.questionCount), 10) || 0;
          for (let i = 0; i < questionCount; i++) {
            result[discipline.type].push(currentQuestionNumber);
            currentQuestionNumber++;
          }
        }
      }
    }
  } else {
    // Debug logs removed for security
  }

  return result;
};

// Create a grid matrix from an array of question numbers
export const createQuestionMatrix = (questionNumbers: number[], columnsCount = 4): (number | null)[][] => {
  if (!questionNumbers || questionNumbers.length === 0) {
    return [[null]];
  }

  const result: (number | null)[][] = [];
  let currentRow: (number | null)[] = [];

  questionNumbers.forEach((questionNumber, index) => {
    currentRow.push(questionNumber);

    if (currentRow.length === columnsCount || index === questionNumbers.length - 1) {
      // Pad the last row with nulls if needed
      while (currentRow.length < columnsCount) {
        currentRow.push(null);
      }
      result.push([...currentRow]);
      currentRow = [];
    }
  });

  return result;
};

// Get question matrix for a specific section
export const getQuestionMatrixForSection = (
  concurso: Concurso,
  section: SectionType,
  sectionQuestions: SectionQuestions
): (number | null)[][] => {
  // Debug logs removed for security
  
  if (!concurso || !section || !sectionQuestions) {
    // Debug logs removed for security
    return [[null]];
  }

  const questionNumbers = sectionQuestions[section] || [];
  // Debug logs removed for security
  
  const matrix = createQuestionMatrix(questionNumbers);
  // Debug logs removed for security
  
  return matrix;
};
