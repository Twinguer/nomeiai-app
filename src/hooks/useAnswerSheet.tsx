import { useState, useEffect } from 'react';
import { Concurso, SectionType, isDisciplineBlock } from '@/types/concursos';
import { supabase } from '@/integrations/supabase/client';
import { getNumericValue, isHierarchicalStructure, getDisciplines } from '@/integrations/supabase/rankings/examStructure';
import { handleQuestionSectionSelection } from './useAnswerSheet/sectionUtils';
import { fetchExistingAnswers as fetchExistingAnswersFromDB } from './useAnswerSheet/fetchExistingAnswers';
import { devLog, sanitizeForLog } from '@/utils/productionLogger';

export const useAnswerSheet = (concurso: Concurso, rankingId: string, selectedBookletId?: string) => {
  const [answers, setAnswers] = useState<{ [key: number]: string }>({});
  const [questionType, setQuestionType] = useState<{ [key: number]: 'basic' | 'specific1' | 'specific2' | 'specific3' | string }>({});
  const [selectedSection, setSelectedSection] = useState<SectionType>('basic');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [discursiveScore, setDiscursiveScore] = useState<number | null>(null);
  const [caseStudy1Score, setCaseStudy1Score] = useState<number | null>(null);
  const [caseStudy2Score, setCaseStudy2Score] = useState<number | null>(null);
  const [caseStudy3Score, setCaseStudy3Score] = useState<number | null>(null);
  const [isHierarchical, setIsHierarchical] = useState<boolean>(false);

  // Initialize with the first available section
  useEffect(() => {
    if (concurso) {
      handleQuestionSectionSelection(concurso, setSelectedSection);
    }
  }, [concurso]);

  // Detect if we're using hierarchical structure
  useEffect(() => {
    if (concurso) {
      const hierarchical = isHierarchicalStructure(concurso);
      setIsHierarchical(hierarchical);
      devLog.log(`[useAnswerSheet] Concurso ${concurso.id} uses hierarchical structure: ${hierarchical}`);
    }
  }, [concurso]);

  const fetchExistingAnswers = async () => {
    try {
      // Buscar dados do usuário atual
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        devLog.log('User not authenticated');
        return;
      }

      // Fetch answers from user_rankings consolidated_data
      const { data: userRankingData, error: rankingError } = await supabase
        .from('user_rankings')
        .select('consolidated_data')
        .eq('user_id', user.id)
        .maybeSingle();

      if (rankingError) {
        devLog.log('No user ranking data found, using empty answers');
        return;
      }

      devLog.log('Fetched user ranking data:', userRankingData?.consolidated_data);

      // Extract user answers from consolidated data (flatten JSONB structure)
      const currentRankingData = userRankingData?.consolidated_data?.rankings?.[rankingId];
      if (currentRankingData?.user_data?.answers) {
        // Usar o selectedBookletId passado como parâmetro ou o do banco
        const bookletIdToUse = selectedBookletId || currentRankingData.selected_booklet_id;
        const bookletData = bookletIdToUse ? currentRankingData.user_data.answers[bookletIdToUse] : null;
        
        if (bookletData && typeof bookletData === 'object') {
          const answersMap: { [key: number]: string } = {};
          const typesMap: { [key: number]: 'basic' | 'specific1' | 'specific2' | 'specific3' | string } = {};

          // Novo formato: { [disciplineType]: { [questionNumber]: answer } }
          Object.entries(bookletData as Record<string, Record<string, string>>).forEach(([disciplineType, questions]) => {
            if (questions && typeof questions === 'object') {
              Object.entries(questions).forEach(([qStr, ans]) => {
                const qNum = parseInt(qStr, 10);
                if (!isNaN(qNum)) {
                  answersMap[qNum] = ans as string;
                  typesMap[qNum] = disciplineType;
                }
              });
            }
          });

          devLog.log('Parsed answers map (flattened):', answersMap);
          devLog.log('Parsed question types map (from disciplines):', typesMap);

          setAnswers(answersMap);
          setQuestionType(typesMap);
        }
      }

      // Buscar scores do ranking consolidado
      const rankingScoresData = currentRankingData?.scores || {};
      
      setDiscursiveScore(
        rankingScoresData.discursive !== null && rankingScoresData.discursive !== undefined
          ? rankingScoresData.discursive
          : null
      );
      setCaseStudy1Score(
        rankingScoresData.case_study_1 !== null && rankingScoresData.case_study_1 !== undefined
          ? rankingScoresData.case_study_1
          : null
      );
      setCaseStudy2Score(
        rankingScoresData.case_study_2 !== null && rankingScoresData.case_study_2 !== undefined
          ? rankingScoresData.case_study_2
          : null
      );
      setCaseStudy3Score(
        rankingScoresData.case_study_3 !== null && rankingScoresData.case_study_3 !== undefined
          ? rankingScoresData.case_study_3
          : null
      );
    } catch (error) {
      devLog.error('Error fetching answers:', error);
    }
  };

  const initializeQuestionTypes = () => {
    if (concurso && Object.keys(questionType).length === 0) {
      const typesMap: { [key: number]: 'basic' | 'specific1' | 'specific2' | 'specific3' | string } = {};
      
      devLog.log('[initializeQuestionTypes] Initializing question types for concurso:', concurso.id);

      // Verificar se estamos usando a estrutura customizada
      // SEMPRE usar a nova estrutura JSONB disciplines (prioridade máxima)
      if (concurso.disciplines && Array.isArray(concurso.disciplines) && concurso.disciplines.length > 0) {
        const hierarchical = isHierarchicalStructure(concurso);
        devLog.log('[initializeQuestionTypes] Using hierarchical structure:', hierarchical);
        
        let questionNumber = 1;

        if (hierarchical) {
          // Processar estrutura hierárquica (blocos -> disciplinas)
          for (const block of concurso.disciplines) {
            // Use TypeGuard to check if this is a DisciplineBlock
            if (isDisciplineBlock(block)) {
              devLog.log('[initializeQuestionTypes] Processing block:', block.name);
              for (const discipline of block.disciplines) {
                if (discipline.isEnabled) {
                  const questionCount = getNumericValue(discipline.questionCount);
                  devLog.log(`[initializeQuestionTypes] Adding ${questionCount} questions of type ${discipline.type} from discipline ${discipline.name}`);
                  
                  for (let i = 0; i < questionCount; i++) {
                    typesMap[questionNumber] = discipline.type;
                    questionNumber++;
                  }
                }
              }
            }
          }
        } else {
          // Processar estrutura plana
          for (const discipline of concurso.disciplines) {
            if (!isDisciplineBlock(discipline) && discipline.isEnabled) {
              const questionCount = getNumericValue(discipline.questionCount);
              devLog.log(`[initializeQuestionTypes] Adding ${questionCount} questions of type ${discipline.type} from flat discipline ${discipline.name}`);
              
              for (let i = 0; i < questionCount; i++) {
                typesMap[questionNumber] = discipline.type;
                questionNumber++;
              }
            }
          }
        }
      } else {
        // Processar estrutura tradicional (legacy)
        let questionNumber = 1;

        if (concurso.has_basic_knowledge && concurso.basic_knowledge_questions) {
          const count = getNumericValue(concurso.basic_knowledge_questions);
          devLog.log(`[initializeQuestionTypes] Adding ${count} basic knowledge questions`);
          
          for (let i = 0; i < count; i++) {
            typesMap[questionNumber] = 'basic';
            questionNumber++;
          }
        }

        if (concurso.has_specific_knowledge_1 && concurso.specific_knowledge_1_questions) {
          const count = getNumericValue(concurso.specific_knowledge_1_questions);
          devLog.log(`[initializeQuestionTypes] Adding ${count} specific knowledge 1 questions`);
          
          for (let i = 0; i < count; i++) {
            typesMap[questionNumber] = 'specific1';
            questionNumber++;
          }
        }

        if (concurso.has_specific_knowledge_2 && concurso.specific_knowledge_2_questions) {
          const count = getNumericValue(concurso.specific_knowledge_2_questions);
          devLog.log(`[initializeQuestionTypes] Adding ${count} specific knowledge 2 questions`);
          
          for (let i = 0; i < count; i++) {
            typesMap[questionNumber] = 'specific2';
            questionNumber++;
          }
        }

        if (concurso.has_specific_knowledge_3 && concurso.specific_knowledge_3_questions) {
          const count = getNumericValue(concurso.specific_knowledge_3_questions);
          devLog.log(`[initializeQuestionTypes] Adding ${count} specific knowledge 3 questions`);
          
          for (let i = 0; i < count; i++) {
            typesMap[questionNumber] = 'specific3';
            questionNumber++;
          }
        }
      }

      devLog.log('Initialized question types mapping:', typesMap);
      setQuestionType(typesMap);
    }
  };

  useEffect(() => {
    // Buscar respostas quando o rankingId muda (troca de ranking)
    // Mas não quando é apenas um re-render após salvamento
    fetchExistingAnswers();
  }, [rankingId, selectedBookletId]);

  useEffect(() => {
    initializeQuestionTypes();
  }, [concurso]);

  const handleAnswerChange = (questionNumber: number, answer: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionNumber]: answer
    }));
  };

  const handleClearAnswer = (questionNumber: number) => {
    setAnswers((prev) => {
      const newAnswers = { ...prev };
      delete newAnswers[questionNumber];
      return newAnswers;
    });
  };

  const getTotalQuestions = () => {
    if (!concurso) return 0;
    
    devLog.log('[getTotalQuestions] Calculating total questions for concurso:', concurso.id);

    let total = 0;

    // Verificar se estamos usando a estrutura customizada
    // SEMPRE usar a nova estrutura JSONB disciplines (prioridade máxima)
    if (concurso.disciplines && Array.isArray(concurso.disciplines) && concurso.disciplines.length > 0) {
      const hierarchical = isHierarchicalStructure(concurso);
      devLog.log('[getTotalQuestions] Using hierarchical structure:', hierarchical);
      
      if (hierarchical) {
        // Processar estrutura hierárquica (blocos -> disciplinas)
        for (const block of concurso.disciplines) {
          if (isDisciplineBlock(block)) {
            for (const discipline of block.disciplines) {
              if (discipline.isEnabled && discipline.questionCount) {
                const count = getNumericValue(discipline.questionCount);
                devLog.log(`[getTotalQuestions] Adding ${count} questions from discipline ${discipline.name}`);
                total += count;
              }
            }
          }
        }
      } else {
        // Processar estrutura plana
        for (const discipline of concurso.disciplines) {
          if (!isDisciplineBlock(discipline) && discipline.isEnabled && discipline.questionCount) {
            const count = getNumericValue(discipline.questionCount);
            devLog.log(`[getTotalQuestions] Adding ${count} questions from flat discipline ${discipline.name}`);
            total += count;
          }
        }
      }
    } else {
      // Processar estrutura tradicional (legacy)
      if (concurso.has_basic_knowledge && concurso.basic_knowledge_questions) {
        const count = getNumericValue(concurso.basic_knowledge_questions);
        devLog.log(`[getTotalQuestions] Adding ${count} basic knowledge questions`);
        total += count;
      }

      if (concurso.has_specific_knowledge_1 && concurso.specific_knowledge_1_questions) {
        const count = getNumericValue(concurso.specific_knowledge_1_questions);
        devLog.log(`[getTotalQuestions] Adding ${count} specific knowledge 1 questions`);
        total += count;
      }

      if (concurso.has_specific_knowledge_2 && concurso.specific_knowledge_2_questions) {
        const count = getNumericValue(concurso.specific_knowledge_2_questions);
        devLog.log(`[getTotalQuestions] Adding ${count} specific knowledge 2 questions`);
        total += count;
      }

      if (concurso.has_specific_knowledge_3 && concurso.specific_knowledge_3_questions) {
        const count = getNumericValue(concurso.specific_knowledge_3_questions);
        devLog.log(`[getTotalQuestions] Adding ${count} specific knowledge 3 questions`);
        total += count;
      }
    }

    devLog.log(`[getTotalQuestions] Total questions: ${total}`);
    return total;
  };

  const getAnsweredQuestionsCount = () => {
    return Object.keys(answers).length;
  };

  const isDiscursiveSection = () => {
    return selectedSection === 'discursive' ||
           selectedSection === 'case_study1' ||
           selectedSection === 'case_study2' ||
           selectedSection === 'case_study3';
  };

  // Função para obter questões baseadas na seção selecionada
  const getSectionQuestions = () => {
    if (!concurso) {
      devLog.log('[getSectionQuestions] No concurso available');
      return [];
    }

    devLog.log('[getSectionQuestions] Getting questions for section:', selectedSection);
    
    // ✅ USAR NOVA FUNÇÃO HELPER: Obter disciplinas de qualquer estrutura
    const disciplines = getDisciplines(concurso);
    
    if (disciplines.length > 0) {
      devLog.log('[getSectionQuestions] Using helper function, found disciplines:', disciplines.length);
      
      let startIndex = 1;
      
      for (const discipline of disciplines) {
        if (discipline.isEnabled) {
          const questionCount = getNumericValue(discipline.questionCount);
          devLog.log(`[getSectionQuestions] Discipline ${discipline.name} (type: ${discipline.type}) has ${questionCount} questions`);

          if (discipline.type === selectedSection) {
            // Retornar o range de questões para esta disciplina
            const questions = Array.from(
              { length: questionCount },
              (_, i) => startIndex + i
            );
            devLog.log(`[getSectionQuestions] Questions for discipline ${discipline.name} (type: ${discipline.type}):`, questions);
            return questions;
          }

          // Atualizar índice inicial para a próxima disciplina
          startIndex += questionCount;
        }
      }
    }
    
    devLog.log('[getSectionQuestions] No questions found for section:', selectedSection);
    return [];
  };

  const getOptionsForQuestion = (questionNumber: number) => {
    if (!concurso?.exam_type) return ['A', 'B', 'C', 'D', 'E'];

    if (concurso.exam_type === 'Certo ou Errado') {
      return ['C', 'E'];
    }

    const count = concurso.alternatives_count || 5;
    return Array.from({ length: count }, (_, i) => String.fromCharCode(65 + i));
  };

  const createAnswerMatrix = () => {
    devLog.log('[createAnswerMatrix] Creating matrix for section:', selectedSection);
    
    const sectionQuestions = getSectionQuestions();
    devLog.log('[createAnswerMatrix] Section questions:', sectionQuestions);
    
    if (sectionQuestions.length === 0) {
      devLog.log('[createAnswerMatrix] No questions found for section:', selectedSection);
      return [];
    }

    const QUESTIONS_PER_ROW = 4;
    const rows = Math.ceil(sectionQuestions.length / QUESTIONS_PER_ROW);

    const matrix = [];

    for (let row = 0; row < rows; row++) {
      const rowData = [];
      for (let col = 0; col < QUESTIONS_PER_ROW; col++) {
        const index = row * QUESTIONS_PER_ROW + col;
        if (index < sectionQuestions.length) {
          rowData.push(sectionQuestions[index]);
        } else {
          rowData.push(null);
        }
      }
      matrix.push(rowData);
    }

    devLog.log('[createAnswerMatrix] Matrix for section', selectedSection, ':', matrix);
    return matrix;
  };

  return {
    answers,
    selectedSection,
    setSelectedSection,
    isSaving,
    setIsSaving,
    error,
    setError,
    savedSuccess,
    setSavedSuccess,
    handleAnswerChange,
    handleClearAnswer,
    getTotalQuestions,
    getAnsweredQuestionsCount,
    getOptionsForQuestion,
    createAnswerMatrix,
    questionType,
    discursiveScore,
    setDiscursiveScore,
    caseStudy1Score,
    setCaseStudy1Score,
    caseStudy2Score,
    setCaseStudy2Score,
    caseStudy3Score,
    setCaseStudy3Score,
    isDiscursiveSection,
    isHierarchical,
    fetchExistingAnswers
  };
};
