// @ts-nocheck
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Concurso, SectionType } from '@/types/concursos';
import { useQuery } from '@tanstack/react-query';
import { fetchExistingAnswers } from './fetchExistingAnswers';
import { getSectionQuestionsDict, getQuestionMatrixForSection, SectionQuestions } from './matrixUtils';
import { createQuestionOptions, getTotalQuestions } from './initializeQuestionTypes';
import { useAnswerManagement } from './useAnswerManagement';
import { useScoreManagement } from './useScoreManagement';
import { getSectionDisplayName, isHierarchicalStructure } from '@/integrations/supabase/rankings/examStructure';
import { handleQuestionSectionSelection } from './sectionUtils';
import { getQuestionStructureFromOfficialAnswers } from './officialAnswersUtils';
import { devLog, sanitizeForLog } from '@/utils/productionLogger';

// Interface para a resposta do fetchExistingAnswers
interface FetchedAnswersData {
  answers?: { [key: number]: string };
  discursiveScore?: number | null;
  caseStudy1Score?: number | null;
  caseStudy2Score?: number | null;
  caseStudy3Score?: number | null;
}

export const useAnswerSheet = (concurso: Concurso, rankingId: string, selectedBookletId?: string) => {
  // devLog.log('[useAnswerSheet] Initialized with:', { selectedBookletId });
  
  const [selectedSection, setSelectedSection] = useState<SectionType>('basic');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [questionOptions, setQuestionOptions] = useState<Record<number, string[]>>({});
  const [sectionQuestions, setSectionQuestions] = useState<SectionQuestions>({});
  const [isHierarchical, setIsHierarchical] = useState<boolean>(false);

  // Get discursive scores from the useScoreManagement hook
  const {
    discursiveScore,
    setDiscursiveScore,
    caseStudy1Score,
    setCaseStudy1Score,
    caseStudy2Score,
    setCaseStudy2Score,
    caseStudy3Score,
    setCaseStudy3Score,
    otherSubjectiveScore,
    setOtherSubjectiveScore
  } = useScoreManagement();

  // Get answer management functions and state from useAnswerManagement hook
  const {
    answers,
    handleAnswerChange,
    handleClearAnswer,
    setAnswers,
    clearAllAnswers
  } = useAnswerManagement();

  // Detect if we're using hierarchical structure
  useEffect(() => {
    if (concurso) {
      const hierarchical = isHierarchicalStructure(concurso);
      setIsHierarchical(hierarchical);
      // Debug logs removed for security
    }
  }, [concurso]);

  // Create question options based on exam type
  useEffect(() => {
    if (concurso) {
      setQuestionOptions(createQuestionOptions(concurso));
    }
  }, [concurso]);

  // Get section questions mapping - use official answers if available, fallback to concurso structure
  const { 
    data: questionStructure, 
    isLoading: isLoadingStructure 
  } = useQuery({
    queryKey: ['question-structure', concurso?.id, selectedBookletId],
    queryFn: async () => {
      if (!concurso?.id) return null;
      
      // Se selectedBookletId estiver vazio, tentar usar o primeiro caderno disponível
      let bookletIdToUse = selectedBookletId;
      if (!bookletIdToUse) {
        // Buscar cadernos disponíveis para usar o primeiro
        const { data: concursoData } = await supabase
          .from('concursos')
          .select('exam_booklets')
          .eq('id', concurso.id)
          .single();
        
        const booklets = concursoData?.exam_booklets || [];
        if (booklets.length > 0) {
          bookletIdToUse = booklets[0].id;
        }
      }
      
      if (!bookletIdToUse) return null;
      
      return await getQuestionStructureFromOfficialAnswers(concurso.id, bookletIdToUse);
    },
    enabled: !!concurso?.id,
    staleTime: 300000, // 5 minutes
    retry: 2
  });

  // Update section questions based on official answers or fallback to concurso structure
  useEffect(() => {
    if (questionStructure?.hasOfficialAnswers) {
      // Debug logs removed for security
      setSectionQuestions(questionStructure.sectionQuestions);
    } else if (concurso) {
      // Debug logs removed for security
      const questions = getSectionQuestionsDict(concurso);
      setSectionQuestions(questions);
    }
  }, [concurso, questionStructure]);

  // Garantir que a seção selecionada exista nas chaves calculadas
  useEffect(() => {
    const keys = Object.keys(sectionQuestions || {});
    if (keys.length === 0) return;
    // Não sobrescrever se o usuário estiver na aba virtual de subjetivas
    if (selectedSection === 'subjetivas') return;
    if (!keys.includes(selectedSection)) {
      setSelectedSection(keys[0] as SectionType);
    }
  }, [sectionQuestions, selectedSection]);

  // Initialize with the first available section
  useEffect(() => {
    if (concurso) {
      handleQuestionSectionSelection(concurso, setSelectedSection);
    }
  }, [concurso]);

  // Fetch existing answers when rankingId changes
  const { 
    data: existingAnswersData, 
    isLoading, 
    refetch: refetchAnswers,
    error: fetchError 
  } = useQuery({
    queryKey: ['user-answers', rankingId],
    queryFn: async (): Promise<FetchedAnswersData> => {
      if (!rankingId) {
        // Debug logs removed for security
        return {};
      }
      
      if (!concurso?.id) {
        // Debug logs removed for security
        return {};
      }
      
      // Debug logs removed for security
      return fetchExistingAnswers(rankingId, selectedBookletId);
    },
    enabled: !!rankingId && !!concurso?.id,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 2
  });

  // Handle data loading with useEffect instead of onSuccess
  useEffect(() => {
    if (existingAnswersData) {
      // Debug logs removed for security
      // Debug logs removed for security
      
      if (existingAnswersData.answers) {
        // Debug logs removed for security
        setAnswers(existingAnswersData.answers);
      }
      
      // Definir TODAS as pontuações subjetivas (incluindo otherSubjectiveScore)
      if (existingAnswersData.discursiveScore !== undefined && existingAnswersData.discursiveScore !== null) {
        // Debug logs removed for security
        setDiscursiveScore(existingAnswersData.discursiveScore);
      }
      if (existingAnswersData.caseStudy1Score !== undefined && existingAnswersData.caseStudy1Score !== null) {
        // Debug logs removed for security
        setCaseStudy1Score(existingAnswersData.caseStudy1Score);
      }
      if (existingAnswersData.caseStudy2Score !== undefined && existingAnswersData.caseStudy2Score !== null) {
        // Debug logs removed for security
        setCaseStudy2Score(existingAnswersData.caseStudy2Score);
      }
      if (existingAnswersData.caseStudy3Score !== undefined && existingAnswersData.caseStudy3Score !== null) {
        // Debug logs removed for security
        setCaseStudy3Score(existingAnswersData.caseStudy3Score);
      }
      if (existingAnswersData.otherSubjectiveScore !== undefined && existingAnswersData.otherSubjectiveScore !== null) {
        // Debug logs removed for security
        setOtherSubjectiveScore(existingAnswersData.otherSubjectiveScore);
      }
    }
  }, [existingAnswersData, setAnswers, setDiscursiveScore, setCaseStudy1Score, setCaseStudy2Score, setCaseStudy3Score, setOtherSubjectiveScore]);

  // Handle fetch errors
  useEffect(() => {
    if (fetchError) {
      devLog.error('[useAnswerSheet] Erro ao carregar dados:', fetchError);
      setError('Erro ao carregar respostas do usuário: ' + fetchError.message);
    }
  }, [fetchError]);

  // Function to create the answer matrix for rendering
  const createAnswerMatrix = useCallback(() => {
    // Debug logs removed for security
    
    if (!concurso || !selectedSection) {
      // Debug logs removed for security
      return [[]];
    }

    const matrix = getQuestionMatrixForSection(concurso, selectedSection, sectionQuestions);
    // Debug logs removed for security
    
    return matrix;
  }, [concurso, selectedSection, sectionQuestions]);

  // Returns the list of answers options for a specific question
  const getOptionsForQuestion = useCallback((questionNumber: number): string[] => {
    return questionOptions[questionNumber] || ['A', 'B', 'C', 'D', 'E'];
  }, [questionOptions]);

  // Get question type based on the exam type
  const questionType = concurso?.exam_type === 'Certo ou Errado' ? 'trueOrFalse' : 'multipleChoice';

  // Function to get the total number of questions
  const getTotalQuestionsFunc = useCallback(() => {
    if (!concurso) return 0;
    
    // Use official answers structure if available
    if (questionStructure?.hasOfficialAnswers) {
      // Debug logs removed for security
      return questionStructure.totalQuestions;
    }
    
    // Fallback to concurso structure
    // Debug logs removed for security
    return getTotalQuestions(concurso);
  }, [concurso, questionStructure]);

  // Function to get the number of answered questions
  const getAnsweredQuestionsCount = useCallback(() => {
    return Object.keys(answers).length;
  }, [answers]);
  
  // Check if the selected section is a discursive-type section
  const isDiscursiveSection = useCallback(() => {
    return selectedSection === 'discursive' || 
           selectedSection === 'case_study1' ||
           selectedSection === 'case_study2' ||
           selectedSection === 'case_study3';
  }, [selectedSection]);
  
  // Get questions for a specific section
  const getSectionQuestions = useCallback((section?: string): number[] => {
    const sectionToUse = section || selectedSection;
    if (!sectionQuestions || !sectionQuestions[sectionToUse]) return [];
    return sectionQuestions[sectionToUse];
  }, [sectionQuestions, selectedSection]);

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
    clearAllAnswers,
    getTotalQuestions: getTotalQuestionsFunc,
    getOptionsForQuestion,
    createAnswerMatrix,
    questionType,
    getAnsweredQuestionsCount,
    discursiveScore,
    setDiscursiveScore,
    caseStudy1Score,
    setCaseStudy1Score,
    caseStudy2Score,
    setCaseStudy2Score,
    caseStudy3Score,
    setCaseStudy3Score,
    otherSubjectiveScore,
    setOtherSubjectiveScore,
    isDiscursiveSection: isDiscursiveSection(),
    getSectionQuestions,
    sectionQuestions,
    isHierarchical,
    isLoading: isLoading || isLoadingStructure,
    refetchAnswers
  };
};

export * from './useScoreManagement';
export * from './matrixUtils';
export * from './useAnswerManagement';
export * from './sectionUtils';