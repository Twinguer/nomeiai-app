import { supabase } from '@/integrations/supabase/client';
import { SectionType } from '@/types/concursos';
import { devLog, sanitizeForLog } from '@/utils/productionLogger';

// Type for storing questions by section
export type SectionQuestions = {
  [key: string]: number[];
};

// Interface for official answer structure
interface OfficialAnswerData {
  answer: string;
  is_nullified?: boolean;
  section_type?: string;
  weight?: number;
}

interface BookletOfficialAnswers {
  questions: { [questionNumber: string]: OfficialAnswerData };
  answers: { [questionNumber: string]: OfficialAnswerData };
}

interface OfficialAnswersData {
  [bookletId: string]: BookletOfficialAnswers;
}

// Get question structure from official answers for a specific booklet
export const getQuestionStructureFromOfficialAnswers = async (
  concursoId: string, 
  bookletId: string
): Promise<{
  totalQuestions: number;
  sectionQuestions: SectionQuestions;
  questionMatrix: (number | null)[][];
  hasOfficialAnswers: boolean;
}> => {
  try {
    // Debug logs removed for security
    
    const { data, error } = await supabase
      .from('concursos')
      .select('official_answers, disciplines')
      .eq('id', concursoId)
      .maybeSingle();

    if (error) {
      devLog.error('[getQuestionStructureFromOfficialAnswers] Erro ao buscar respostas oficiais:', error);
      return { totalQuestions: 0, sectionQuestions: {}, questionMatrix: [], hasOfficialAnswers: false };
    }

    if (!data?.official_answers?.[bookletId]) {
      // Se não encontrou o caderno específico, mas há apenas um caderno, usar o primeiro disponível
      const availableBooklets = Object.keys(data?.official_answers || {});
      if (availableBooklets.length === 1) {
        bookletId = availableBooklets[0];
        devLog.log('[getQuestionStructureFromOfficialAnswers] Usando único caderno disponível:', bookletId);
      } else {
        devLog.log('[getQuestionStructureFromOfficialAnswers] Nenhuma resposta oficial encontrada para o caderno:', bookletId);
        return { totalQuestions: 0, sectionQuestions: {}, questionMatrix: [], hasOfficialAnswers: false };
      }
    }

    const bookletData = data.official_answers[bookletId];
    const questions = bookletData.questions || bookletData.answers || {};
    const disciplinesData = data.disciplines || null;
    
    // Normalizar disciplines para array de blocos (suporta JSONB com blocks e array legado)
    let blocksArray: any[] = [];
    if (disciplinesData && typeof disciplinesData === 'object' && !Array.isArray(disciplinesData) && (disciplinesData as any).blocks) {
      blocksArray = (disciplinesData as any).blocks;
    } else if (Array.isArray(disciplinesData)) {
      blocksArray = disciplinesData as any[];
    }
    
    // Debug logs removed for security
    
    // Debug logs removed for security
    // Debug logs removed for security
    
    // Extrair números das questões das respostas oficiais
    const questionNumbers = Object.keys(questions)
      .map(Number)
      .filter(num => !isNaN(num))
      .sort((a, b) => a - b);
    
    const totalQuestions = questionNumbers.length;
    // Debug logs removed for security
    
    // Agrupar questões por seção baseado nas respostas oficiais
    const sectionQuestions: SectionQuestions = {};
    
    // Se temos disciplinas customizadas, usar a estrutura do formulário
    if (blocksArray && blocksArray.length > 0) {
      // Debug logs removed for security
      
      // Mapear disciplinas para seções
      const disciplineToSectionMap: { [key: string]: SectionType } = {};
      
      blocksArray.forEach((block: any) => {
        if (block?.disciplines && Array.isArray(block.disciplines)) {
          block.disciplines.forEach((discipline: any) => {
            if (discipline.isEnabled && discipline.type) {
              // Para disciplinas customizadas, usar o tipo diretamente
              let sectionType: SectionType;
              if (discipline.type.startsWith('custom_')) {
                sectionType = discipline.type as SectionType;
              } else {
                // Mapear tipos de disciplina tradicionais para seções
                const typeMap: { [key: string]: SectionType } = {
                  'basic_knowledge': 'basic',
                  'specific_knowledge_1': 'specific1',
                  'specific_knowledge_2': 'specific2', 
                  'specific_knowledge_3': 'specific3'
                };
                sectionType = typeMap[discipline.type] || 'basic';
              }
              disciplineToSectionMap[discipline.type] = sectionType;
              // Debug logs removed for security
            }
          });
        }
      });
      
      // Distribuir questões baseado na estrutura de disciplinas
      let questionIndex = 0;
      blocksArray.forEach((block: any) => {
        if (block?.disciplines && Array.isArray(block.disciplines)) {
          block.disciplines.forEach((discipline: any) => {
            if (discipline.isEnabled && discipline.questionCount > 0) {
              const sectionType = disciplineToSectionMap[discipline.type] || 'basic';
              const questionsForThisDiscipline = Math.min(discipline.questionCount, questionNumbers.length - questionIndex);
              
              // Debug logs removed for security
              
              // Inicializar array da seção se não existir
              if (!sectionQuestions[sectionType]) sectionQuestions[sectionType] = [];
              
              for (let i = 0; i < questionsForThisDiscipline; i++) {
                if (questionIndex < questionNumbers.length) {
                  sectionQuestions[sectionType].push(questionNumbers[questionIndex]);
                  // Debug logs removed for security
                  questionIndex++;
                }
              }
            }
          });
        }
      });
      
      // Se sobrou questões, distribuir para básico
      if (!sectionQuestions.basic) sectionQuestions.basic = [];
      while (questionIndex < questionNumbers.length) {
        sectionQuestions.basic.push(questionNumbers[questionIndex]);
        questionIndex++;
      }
    } else {
      // Fallback: usar lógica baseada no número da questão
      devLog.log('[getQuestionStructureFromOfficialAnswers] Usando distribuição por número da questão (fallback)');
      
      questionNumbers.forEach(questionNumber => {
        const questionData = questions[questionNumber.toString()];
        let sectionType: SectionType = 'basic'; // default
        
        // Determinar seção baseada nos dados da questão
        if (questionData.section_type) {
          const sectionTypeMap: { [key: string]: SectionType } = {
            'basic': 'basic',
            'specific1': 'specific1', 
            'specific2': 'specific2',
            'specific3': 'specific3',
            'custom_9f394aac': 'basic' // Mapear seções customizadas para básico
          };
          sectionType = sectionTypeMap[questionData.section_type] || 'basic';
        } else {
          // Lógica de fallback baseada no número da questão
          const totalBasic = Math.ceil(totalQuestions * 0.4);
          const totalSpecific1 = Math.ceil(totalQuestions * 0.3);
          const totalSpecific2 = Math.ceil(totalQuestions * 0.2);
          const totalSpecific3 = totalQuestions - totalBasic - totalSpecific1 - totalSpecific2;
          
          if (questionNumber <= totalBasic) {
            sectionType = 'basic';
          } else if (questionNumber <= totalBasic + totalSpecific1) {
            sectionType = 'specific1';
          } else if (questionNumber <= totalBasic + totalSpecific1 + totalSpecific2) {
            sectionType = 'specific2';
          } else {
            sectionType = 'specific3';
          }
        }
        
        if (sectionQuestions[sectionType]) {
          sectionQuestions[sectionType].push(questionNumber);
        }
      });
    }
    
    // Debug logs removed for security
    
    // Criar matriz de questões (simplificada por enquanto)
    const questionMatrix: (number | null)[][] = [];
    const questionsPerRow = 5; // 5 questões por linha
    
    for (let i = 0; i < questionNumbers.length; i += questionsPerRow) {
      const row: (number | null)[] = [];
      for (let j = 0; j < questionsPerRow; j++) {
        const questionIndex = i + j;
        if (questionIndex < questionNumbers.length) {
          row.push(questionNumbers[questionIndex]);
        } else {
          row.push(null);
        }
      }
      questionMatrix.push(row);
    }
    
    // Debug logs removed for security
    
    return {
      totalQuestions,
      sectionQuestions,
      questionMatrix,
      hasOfficialAnswers: true
    };
    
  } catch (error) {
    devLog.error('[getQuestionStructureFromOfficialAnswers] Erro ao processar respostas oficiais:', error);
    return { totalQuestions: 0, sectionQuestions: {}, questionMatrix: [], hasOfficialAnswers: false };
  }
};

// Get nullified questions from official answers
export const getNullifiedQuestionsFromOfficialAnswers = async (
  concursoId: string,
  bookletId: string
): Promise<{ question_number: number }[]> => {
  try {
    const { data, error } = await supabase
      .from('concursos')
      .select('official_answers')
      .eq('id', concursoId)
      .maybeSingle();

    if (error || !data?.official_answers?.[bookletId]) {
      return [];
    }

    const bookletData = data.official_answers[bookletId];
    const questions = bookletData.questions || bookletData.answers || {};
    
    const nullifiedQuestions = Object.entries(questions)
      .filter(([_, answerData]: [string, any]) => answerData.is_nullified)
      .map(([questionNum, _]) => ({ question_number: parseInt(questionNum) }));
      
    return nullifiedQuestions;
  } catch (error) {
    devLog.error('[getNullifiedQuestionsFromOfficialAnswers] Erro ao buscar questões anuladas:', error);
    return [];
  }
};
