import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Save, AlertTriangle, Check, HelpCircle, AlertCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Concurso, SectionType } from '@/types/concursos';
import { getDisciplines } from '@/integrations/supabase/rankings/examStructure';
import { AnswerMatrix } from './AnswerMatrix';
import { AnswerSheetHeader } from './AnswerSheetHeader';
import { useAnswerSheet } from '@/hooks/useAnswerSheet/index'; // Updated import path
import { useSaveAnswers } from '@/modules/rankings/hooks/useSaveAnswers';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SubjectScoresTab } from './SubjectScoresTab';
import { ExamTypeWarning } from './ExamTypeWarning';
import { BookletSwitcher } from './BookletSwitcher';
import { sectionDisplayNames, updateSectionDisplayNames } from '@/integrations/supabase/rankings/examStructure';
import { checkMissingOfficialAnswers } from '@/hooks/useAnswerSheet/questionCountUtils';
import { getNullifiedQuestionsFromOfficialAnswers } from '@/hooks/useAnswerSheet/officialAnswersUtils';
import { toast } from 'sonner';
import { migrateObjectScores, createInitialObjectScores } from '@/utils/consolidatedDataMapper';
import { useSubscription } from '@/modules/payments';
import { useEditLimits } from '@/hooks/useEditLimits';
import { devLog, sanitizeForLog } from '@/utils/productionLogger';
import { isConsensusMode } from '@/components/Admin/CreateRanking/GabaritoStatusSelector';

interface AnswerSheetProps {
  concurso: Concurso;
  rankingId: string;
  onSuccess: () => void;
}

export const AnswerSheet: React.FC<AnswerSheetProps> = ({
  concurso,
  rankingId,
  onSuccess
}) => {
  // Debug logs removed for security
  
  const [nullifiedQuestions, setNullifiedQuestions] = useState<Set<number>>(new Set());
  const [lastCheckedNullifiedCount, setLastCheckedNullifiedCount] = useState<number>(0);
  const [sectionLabels, setSectionLabels] = useState<Record<string, string>>({...sectionDisplayNames});
  const [missingOfficialAnswers, setMissingOfficialAnswers] = useState<boolean>(false);
  const [isConsensusRanking, setIsConsensusRanking] = useState<boolean>(() => isConsensusMode(concurso));
  const [checkingOfficialAnswers, setCheckingOfficialAnswers] = useState<boolean>(true);
  const [selectedBookletId, setSelectedBookletId] = useState<string>('');
  const [subjectScores, setSubjectScores] = useState<Record<string, number>>({});

  // Fetch user ranking data first to get selectedBookletId
  const {
    data: userRankingData,
    isLoading: isLoadingRanking,
    refetch: refetchRanking
  } = useQuery({
    queryKey: ['user-ranking-detail', rankingId],
    queryFn: async () => {
      // Debug logs removed for security
      
      // Buscar dados do usuário atual
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        // Debug logs removed for security
        throw new Error('User not authenticated');
      }

      // Debug logs removed for security

      const { data, error } = await supabase
        .from('user_rankings')
        .select('consolidated_data')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (error) {
        devLog.error('[AnswerSheet] Erro ao buscar dados do ranking:', error);
        throw error;
      }
      
      // Debug logs removed for security
      
      // Extrair dados do ranking específico
      const rankingData = data?.consolidated_data?.rankings?.[rankingId];
      // Debug logs removed for security
      
      return rankingData || {};
    },
    staleTime: 1000
  });

  // Get selected booklet ID from user ranking data (CORRIGIDO: usar estrutura JSONB)
  const selectedBookletIdFromData = userRankingData?.selected_booklet_id || '';

  const {
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
    getTotalQuestions,
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
    isDiscursiveSection,
    getSectionQuestions,
    sectionQuestions,
    isHierarchical,
    isLoading,
    refetchAnswers
  } = useAnswerSheet(concurso, rankingId, selectedBookletIdFromData);

  // Check for subjective content using JSONB disciplines + direct fields
  let hasSubjectiveSections = false;
  
  // Verificar nova estrutura hierárquica (objeto com blocks)
  if (concurso.disciplines && typeof concurso.disciplines === 'object' && !Array.isArray(concurso.disciplines) && concurso.disciplines.blocks) {
    for (const block of concurso.disciplines.blocks) {
      if (block.disciplines && Array.isArray(block.disciplines)) {
        for (const discipline of block.disciplines) {
          if (discipline.isEnabled && ['discursive', 'case_study_1', 'case_study_2', 'case_study_3', 'other_subjective'].includes(discipline.type)) {
            hasSubjectiveSections = true;
            break;
          }
        }
      }
      if (hasSubjectiveSections) break;
    }
  }
  // Verificar estrutura antiga (array de blocos)
  else if (concurso.disciplines && Array.isArray(concurso.disciplines)) {
    for (const discipline of concurso.disciplines) {
      if ('disciplines' in discipline) {
        // Hierarchical structure (blocks -> disciplines)
        if (discipline.disciplines?.some(d => 
          d.isEnabled && ['discursive', 'case_study_1', 'case_study_2', 'case_study_3', 'other_subjective'].includes(d.type)
        )) {
          hasSubjectiveSections = true;
          break;
        }
      } else {
        // Flat structure
        if (discipline.isEnabled && ['discursive', 'case_study_1', 'case_study_2', 'case_study_3', 'other_subjective'].includes(discipline.type)) {
          hasSubjectiveSections = true;
          break;
        }
      }
    }
  }
  
  // Fallback para campos diretos e JSONB subjects
  hasSubjectiveSections = hasSubjectiveSections || 
    (concurso as any).has_discursive || 
    (concurso as any).has_case_study_1 || 
    (concurso as any).has_case_study_2 || 
    (concurso as any).has_case_study_3 || 
    (concurso as any).has_other_subjective ||
    concurso.subjects?.discr === true ||
    concurso.subjects?.case1 === true ||
    concurso.subjects?.case2 === true ||
    concurso.subjects?.case3 === true ||
    concurso.subjects?.other === true;

  // Fetch exam booklets for this concurso - MOVED UP to avoid initialization error
  const {
    data: examBooklets,
    isLoading: isLoadingBooklets
  } = useQuery({
    queryKey: ['exam-booklets', concurso.id],
    queryFn: async () => {
      // Debug logs removed for security
      
      const { data, error } = await supabase
        .from('concursos')
        .select('exam_booklets')
        .eq('id', concurso.id)
        .single();
      
      if (error) {
        devLog.error('[AnswerSheet] Erro ao buscar cadernos:', error);
        throw error;
      }
      
      // Ordenar por display_order e retornar array
      const booklets = data?.exam_booklets || [];
      // Debug logs removed for security
      
      return booklets.sort((a: any, b: any) => (a.display_order || 0) - (b.display_order || 0));
    }
  });

  // Update local state when data changes
  useEffect(() => {
    if (selectedBookletIdFromData && selectedBookletIdFromData !== selectedBookletId) {
      setSelectedBookletId(selectedBookletIdFromData);
      // Debug logs removed for security
    }
  }, [selectedBookletIdFromData, selectedBookletId]);

  // Initialize selectedBookletId if not set and examBooklets are available
  useEffect(() => {
    if (!selectedBookletId && examBooklets && examBooklets.length > 0) {
      setSelectedBookletId(examBooklets[0].id);
      // Debug logs removed for security
    }
  }, [selectedBookletId, examBooklets]);

  // Update selectedBookletIdFromData when examBooklets become available
  useEffect(() => {
    if (!selectedBookletIdFromData && examBooklets && examBooklets.length > 0) {
      setSelectedBookletId(examBooklets[0].id);
      // Debug logs removed for security
    }
  }, [selectedBookletIdFromData, examBooklets]);

  // Set selected booklet from user ranking data
  useEffect(() => {
    if (userRankingData?.selected_booklet_id && !selectedBookletId) {
      setSelectedBookletId(userRankingData.selected_booklet_id);
    }
  }, [userRankingData]);


  // Handle booklet change from BookletSwitcher (MANTÉM as marcações)
  const handleBookletChanged = async (newBookletId: string, newAnswers: Record<number, string>) => {
    // Debug logs removed for security
    // Debug logs removed for security
    // Debug logs removed for security
    // Debug logs removed for security
    
    // MANTER as respostas atuais - não limpar!
    // As respostas serão recalculadas com o novo gabarito
    
    // Atualizar o ID do caderno selecionado
    setSelectedBookletId(newBookletId);
    
    // Salvar o novo selectedBookletId no banco de dados
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Buscar dados atuais
        const { data: currentData } = await supabase
          .from('user_rankings')
          .select('consolidated_data')
          .eq('user_id', user.id)
          .single();
        
        if (currentData?.consolidated_data) {
          // Atualizar o selected_booklet_id
          const updatedData = {
            ...currentData.consolidated_data,
            rankings: {
              ...currentData.consolidated_data.rankings,
              [rankingId]: {
                ...currentData.consolidated_data.rankings[rankingId],
                selected_booklet_id: newBookletId
              }
            }
          };
          
          const { error } = await supabase
            .from('user_rankings')
            .update({ consolidated_data: updatedData })
            .eq('user_id', user.id);
          
          if (error) {
            devLog.error('[AnswerSheet] Erro ao salvar selectedBookletId:', error);
          } else {
            // Debug logs removed for security
          }
        }
      }
    } catch (error) {
      devLog.error('[AnswerSheet] Erro ao salvar selectedBookletId:', error);
    }
    
    toast.success(`Caderno alterado para ${getBookletName(newBookletId)}. Marcações mantidas e score recalculado.`);
  };

  // Verify if the official answer key exists
  useEffect(() => {
    const checkOfficialAnswerKey = async () => {
      if (!concurso?.id) return;

      setCheckingOfficialAnswers(true);
      try {
        if (isConsensusMode(concurso)) {
          setIsConsensusRanking(true);
          setMissingOfficialAnswers(false);
          return;
        }

        setIsConsensusRanking(false);

        if (!examBooklets || examBooklets.length === 0) {
          return;
        }

        const bookletToCheck = selectedBookletIdFromData || examBooklets[0].id;
        const result = await checkMissingOfficialAnswers(concurso.id, bookletToCheck);

        if (result) {
          setMissingOfficialAnswers(true);
          toast.warning(
            'O gabarito da banca ainda não está completo neste caderno. A pontuação pode ser recalculada quando o gabarito for cadastrado.',
            { duration: 8000 }
          );
        } else {
          setMissingOfficialAnswers(false);
        }
      } catch (err) {
        devLog.error('[AnswerSheet] Erro ao verificar gabarito oficial:', err);
      } finally {
        setCheckingOfficialAnswers(false);
      }
    };

    checkOfficialAnswerKey();
  }, [concurso?.id, concurso?.gabarito_status, examBooklets, selectedBookletIdFromData]);

  // Update section display names with custom disciplines
  useEffect(() => {
    if (concurso) {
      const updatedNames = updateSectionDisplayNames(concurso);
      setSectionLabels(updatedNames);
      // Debug logs removed for security
    }
  }, [concurso]);

  // Get subscription info for edit limits
  const { isPro, maxEditCount } = useSubscription();
  
  // Get edit count from user ranking data
  const editCount = userRankingData?.edit_count || 0;
  
  // Use RPC function to validate edit limits (backend validation)
  const editLimits = useEditLimits(rankingId, editCount);
  
  // Define editsLeft and canEdit variables (com limite dinâmico baseado no plano)
  // Use backend validation if available, otherwise fallback to frontend validation
  const canEdit = editLimits.isLoading 
    ? (isPro || editCount < 3) // Fallback durante carregamento
    : (editLimits.allowed ?? (isPro || editCount < 3));
  
  const editsLeft = editLimits.isLoading
    ? (isPro ? Infinity : Math.max(0, 3 - editCount)) // Fallback durante carregamento
    : (editLimits.remaining_edits ?? (isPro ? Infinity : Math.max(0, 3 - editCount)));

  // Fetch nullified questions for the selected booklet
  const {
    data: nullifiedData,
    isLoading: isLoadingNullified,
    refetch: refetchNullified
  } = useQuery({
      queryKey: ['nullified-questions', concurso.id, selectedBookletIdFromData],
      queryFn: async () => {
          if (!selectedBookletIdFromData) return [];
          
          // Debug logs removed for security
          return await getNullifiedQuestionsFromOfficialAnswers(concurso.id, selectedBookletIdFromData);
      },
      enabled: !!selectedBookletIdFromData,
      staleTime: 300000, // 5 minutos - reduzir queries desnecessárias
      refetchOnWindowFocus: false, // Desabilitado para melhor performance
      refetchInterval: false // Desabilitado - era muito agressivo (5s)
  });

  // Import saveAnswers hook with booklet support (CORRIGIDO para reagir a mudanças no selectedBookletId)
  // Debug logs removed for security

  // Debug logs removed for security

  // Debug logs removed for security

  const { handleSaveAnswers: saveAnswersService } = useSaveAnswers({
    rankingId,
    concurso,
    answers,
    setIsSaving,
    setError,
    setSavedSuccess,
    onSuccess,
    discursiveScore: subjectScores.discursive || 0,
    caseStudy1Score: subjectScores.case_study_1 || 0,
    caseStudy2Score: subjectScores.case_study_2 || 0,
    caseStudy3Score: subjectScores.case_study_3 || 0,
    subjectScores,
    editCount: userRankingData?.edit_count || 0,
    nullifiedQuestions,
    selectedBookletId: selectedBookletIdFromData // CRÍTICO: Reage a mudanças no caderno selecionado
  });

  // Initialize object_scores from user ranking data - NOVA ESTRUTURA COMPATÍVEL
  useEffect(() => {
    // Verificar se userRankingData existe antes de prosseguir
    if (!userRankingData) {
      // Debug logs removed for security
      return;
    }

    // Debug logs removed for security
    
    let initialScores: Record<string, number> = {};
    
    // ✅ CORREÇÃO: Acessar user_data corretamente
    const userData = userRankingData.user_data || {};
    
    // 1. Se existir object_scores, migrar para a nova estrutura
    if (userData.object_scores) {
      // Debug logs removed for security
      initialScores = migrateObjectScores(userData.object_scores, concurso);
    } else {
      // Debug logs removed for security
      initialScores = createInitialObjectScores(concurso);
    }
    
    // 2. Buscar valores das notas subjetivas de user_data.subjectives
    if (userData.subjectives) {
      const subjectiveFields = {
        'discursive': userData.subjectives.discursive,
        'case_study_1': userData.subjectives.case_study_1,
        'case_study_2': userData.subjectives.case_study_2,
        'case_study_3': userData.subjectives.case_study_3,
        'other_subjective': userData.subjectives.other_subjective
      };
      
      for (const [field, value] of Object.entries(subjectiveFields)) {
        if (value !== undefined && value !== null) {
          initialScores[field] = value;
          // Debug logs removed for security
        }
      }
    }
    
    // Debug logs removed for security
    // Debug logs removed for security
    // Debug logs removed for security
    setSubjectScores(initialScores);
  }, [userRankingData, concurso]);

  // NOVO: Sincronizar subjectScores com valores do useAnswerSheet hook
  useEffect(() => {
    // Debug logs removed for security
    
    setSubjectScores(prev => {
      const updated = { ...prev };
      
      if (discursiveScore !== null && discursiveScore !== undefined) {
        updated.discursive = discursiveScore;
      }
      if (caseStudy1Score !== null && caseStudy1Score !== undefined) {
        updated.case_study_1 = caseStudy1Score;
      }
      if (caseStudy2Score !== null && caseStudy2Score !== undefined) {
        updated.case_study_2 = caseStudy2Score;
      }
      if (caseStudy3Score !== null && caseStudy3Score !== undefined) {
        updated.case_study_3 = caseStudy3Score;
      }
      if (otherSubjectiveScore !== null && otherSubjectiveScore !== undefined) {
        updated.other_subjective = otherSubjectiveScore;
      }
      
      // Debug logs removed for security
      return updated;
    });
  }, [discursiveScore, caseStudy1Score, caseStudy2Score, caseStudy3Score, otherSubjectiveScore]);

  // Update nullified questions set
  useEffect(() => {
    if (nullifiedData && nullifiedData.length > 0) {
      const nullifiedSet = new Set(nullifiedData.map(item => item.question_number));
      setNullifiedQuestions(nullifiedSet);
      // Debug logs removed for security

      // Check if there was a change in the number of nullified questions
      if (nullifiedSet.size !== lastCheckedNullifiedCount) {
        // Debug logs removed for security

        setLastCheckedNullifiedCount(nullifiedSet.size);
      }
    }
  }, [nullifiedData, lastCheckedNullifiedCount]);

  // Certifique-se de que setSelectedBookletId é usado corretamente após salvar as respostas
  useEffect(() => {
    if (savedSuccess) {
      // Debug logs removed for security
      refetchRanking();
      // Atualizar o estado do caderno após refetch
      const updateBookletId = async () => {
        // Buscar dados do usuário atual
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: updatedRanking } = await supabase
          .from('user_rankings')
          .select('consolidated_data')
          .eq('user_id', user.id)
          .maybeSingle();

        if (updatedRanking?.consolidated_data?.rankings?.[rankingId]?.selected_booklet_id) {
          setSelectedBookletId(updatedRanking.consolidated_data.rankings[rankingId].selected_booklet_id);
        }
      };
      updateBookletId();
    }
  }, [savedSuccess]);

  const handleSaveAnswers = async () => {
    if (!concurso?.id) {
      setError("ID do concurso não encontrado");
      return;
    }

    if (!selectedBookletIdFromData) {
      setError("É necessário selecionar um caderno de prova antes de salvar as respostas");
      return;
    }

    // Debug logs removed for security
    // Debug logs removed for security

    const totalQuestions = getTotalQuestions();
    const answeredQuestions = getAnsweredQuestionsCount();

    // Also consider nullified questions as "answered" for validation
    const effectivelyAnsweredQuestions = answeredQuestions +
      Array.from(nullifiedQuestions).filter(qNum => !answers[qNum]).length;

    // Debug logs removed for security

    // Para provas "Certo ou Errado", permitir questões em branco
    // Para provas de múltipla escolha, exigir todas as respostas
    const isCertoErrado = concurso.exam_type === 'Certo ou Errado';
    
    if (!isCertoErrado && effectivelyAnsweredQuestions < totalQuestions) {
      // Identify unanswered questions (excluding nullified ones) - APENAS para múltipla escolha
      const unansweredQuestions = [];
      const allQuestions = getAllQuestionsFromAllSections();

      // For each question, check if it's answered or nullified
      for (const qNum of allQuestions) {
        if (!answers[qNum] && !nullifiedQuestions.has(qNum)) {
          unansweredQuestions.push(qNum);
        }
      }

      if (unansweredQuestions.length > 0) {
        // Debug logs removed for security
        setError(`Existem questões que precisam ser respondidas: ${unansweredQuestions.sort((a, b) => a - b).join(', ')}`);
        return;
      }
    }

    try {
      // Debug logs removed for security
      // Debug logs removed for security
      setIsSaving(true);
      setError(null);

      // Call the saveAnswersService
      await saveAnswersService();
      await refetchNullified();
      // Debug logs removed for security
    } catch (error: any) {
      devLog.error("[AnswerSheet] Erro durante o salvamento:", error);
      setIsSaving(false);
      setError(error.message || "Erro ao salvar respostas");
    }
  };

  const handleScoreChange = (
    value: string,
    setter: React.Dispatch<React.SetStateAction<number | null>>,
    scoreName: string
  ) => {
    if (value === '') {
      setter(null);
      return;
    }

    const numberValue = parseFloat(value);
    if (isNaN(numberValue)) return;

    if (numberValue < 0 || numberValue > 100) {
      setError(`A nota da ${scoreName} deve estar entre 0 e 100.`);
      return;
    }

    setter(numberValue);
  };

  const handleSubjectScoreChange = (key: string, value: number) => {
    // Debug logs removed for security
    setSubjectScores(prev => {
      const updated = { ...prev, [key]: value };
      // Debug logs removed for security
      return updated;
    });
  };

  // Get booklet name
  const getBookletName = (bookletId?: string) => {
    if (!bookletId || !examBooklets) return 'Não informado';
    const booklet = examBooklets.find(b => b.id === bookletId);
    return booklet?.name || 'Não informado';
  };

  // Show warning if no booklet is selected
  // Debug logs removed for security

  if (!selectedBookletIdFromData && !isLoadingRanking) {
    // Debug logs removed for security
    return (
      <Card className="shadow-lg">
        <CardContent className="flex flex-col items-center justify-center p-12 space-y-4">
          <AlertTriangle className="h-8 w-8 text-amber-500" />
          <h3 className="text-lg font-semibold">Caderno não selecionado</h3>
          <p className="text-center text-muted-foreground">
            É necessário selecionar um caderno de prova antes de preencher o cartão de respostas.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (isLoadingRanking || isLoadingBooklets || (checkingOfficialAnswers && !missingOfficialAnswers)) {
    return <Card>
        <CardContent className="flex flex-col items-center justify-center p-12 space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-center text-muted-foreground">Carregando cartão de respostas...</p>
        </CardContent>
      </Card>;
  }

  const totalQuestions = getTotalQuestions();
  const answeredQuestions = getAnsweredQuestionsCount();
  const progressPercentage = totalQuestions ? answeredQuestions / totalQuestions * 100 : 0;
  const hasNullifiedQuestions = nullifiedQuestions.size > 0;

  // Utility function to get all questions from all sections
  const getAllQuestionsFromAllSections = () => {
    const allQuestions = [];
    
    // Iterate through all possible questions up to the total expected
    const totalQuestions = getTotalQuestions();
    for (let i = 1; i <= totalQuestions; i++) {
      allQuestions.push(i);
    }
    
    return allQuestions;
  };

  // Get objective sections
  const getObjectiveSections = (sectionQuestionsData: any) => {
    if (!concurso) return [];
    
    // Debug logs removed for security
    
    // ✅ USAR NOVA FUNÇÃO HELPER: Obter disciplinas de qualquer estrutura
    const disciplines = getDisciplines(concurso);
    
    const sections = [];
    
    if (disciplines.length > 0) {
      // Debug logs removed for security
      
      for (const discipline of disciplines) {
        if (discipline.isEnabled && discipline.type) {
          // Debug logs removed for security
          sections.push({
            key: discipline.type,
            label: discipline.blockName ? `${discipline.blockName} - ${discipline.name}` : discipline.name
          });
        }
      }
    } else {
      // Debug logs removed for security
    }
    
    // Debug logs removed for security
    return sections;
  };

  // Handle section changes
  const handleSectionChange = (value: string) => {
    setSelectedSection(value as SectionType);
  };

  const objectiveSections = getObjectiveSections(sectionQuestions);
  const matrix = createAnswerMatrix();
  

  return (
    <Card className="shadow-lg w-full h-full mx-auto p-4">
      <CardHeader className="bg-muted/30 border-b border-border">
        <CardTitle className="text-xl md:text-2xl">
          Cartão de Respostas - {concurso.titulo}
        </CardTitle>
        <div className="space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-sm">
            <span className="font-medium">Caderno selecionado:</span>
            <span className="px-2 py-1 bg-primary/10 text-primary rounded-md font-medium break-words max-w-full">
              {getBookletName(selectedBookletIdFromData)}
            </span>
          </div>
          {userRankingData?.edit_count !== undefined && (
            <div className="text-sm font-medium text-primary">
              {isPro ? (
                <span>Edições ilimitadas (Plano Pro)</span>
              ) : (
                <>
                  Edições disponíveis: {editsLeft === Infinity ? 'Ilimitadas' : `${editsLeft} de 3`}
                  {!canEdit && (
                    <span className="text-destructive ml-2">
                      (Você atingiu o limite de edições permitidas)
                    </span>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4 sm:space-y-6 pt-4 sm:pt-6 px-4 sm:px-6">
        {error && (
          <div className="bg-destructive/15 p-3 rounded-md flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-4 w-4" />
            <p>{error}</p>
          </div>
        )}

        {editLimits.error && (
          <div className="bg-destructive/15 p-3 rounded-md flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-4 w-4" />
            <p>Erro ao verificar limites de edição. Tente novamente.</p>
          </div>
        )}

        {!editLimits.isLoading && !editLimits.allowed && editLimits.message && (
          <div className="bg-destructive/15 p-3 rounded-md flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-4 w-4" />
            <p>{editLimits.message}</p>
          </div>
        )}

        {savedSuccess && (
          <div className="bg-green-100 p-3 rounded-md flex items-center gap-2 text-green-800">
            <Check className="h-4 w-4" />
            <p>Respostas salvas com sucesso! Calculando pontuação...</p>
          </div>
        )}

        {isConsensusRanking && (
          <div className="bg-primary/5 border border-primary/20 rounded-md p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <h4 className="font-medium text-foreground">Ranking por consenso</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Ainda não há gabarito da banca. Sua pontuação será calculada com base no consenso entre
                  os participantes até o gabarito oficial ser cadastrado.
                </p>
              </div>
            </div>
          </div>
        )}

        {!isConsensusRanking && missingOfficialAnswers && (
          <div className="bg-amber-100 border border-amber-300 rounded-md p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5" />
              <div>
                <h4 className="font-medium text-amber-800">Gabarito da banca incompleto</h4>
                <p className="text-sm text-amber-700 mt-1">
                  O gabarito cadastrado para este caderno parece incompleto. Você ainda pode preencher suas
                  respostas; a pontuação será atualizada quando o gabarito estiver completo.
                </p>
              </div>
            </div>
          </div>
        )}

        <AnswerSheetHeader concurso={concurso} getTotalQuestions={getTotalQuestions} />

        <ExamTypeWarning examType={concurso.exam_type as 'Alternativas' | 'Certo ou Errado'} />

        {/* Booklet Switcher - NOVO */}
        {examBooklets && examBooklets.length > 1 && selectedBookletIdFromData && (
          <BookletSwitcher
            booklets={examBooklets}
            currentBookletId={selectedBookletIdFromData}
            rankingId={rankingId}
            onBookletChanged={handleBookletChanged}
            disabled={isSaving}
          />
        )}

        {hasNullifiedQuestions && (
          <div className="bg-amber-50 border border-amber-200 rounded-md p-4">
            <div className="flex items-start gap-3">
              <HelpCircle className="h-5 w-5 text-amber-500 mt-0.5" />
              <div>
                <h4 className="font-medium text-amber-800"></h4>
                <p className="text-sm text-amber-700 mt-1">
                  Este concurso possui {nullifiedQuestions.size} {nullifiedQuestions.size === 1 ? 'questão anulada' : 'questões anuladas'}.
                </p>
                <p className="text-xs text-amber-600 mt-2">
                  Questão anulada: {Array.from(nullifiedQuestions).sort((a, b) => a - b).join(', ')}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="font-medium">Progresso: {answeredQuestions} de {totalQuestions} questões</div>
          <div className="text-sm text-muted-foreground">{Math.round(progressPercentage)}% completo</div>
        </div>
        <Progress value={progressPercentage} className="h-2" />

        {/* Sistema de Abas Unificado - Objetivas + Subjetivas */}
        <div className="space-y-4">
          <div className="border rounded-md overflow-hidden shadow-sm">
            <Tabs
              value={selectedSection}
              onValueChange={handleSectionChange}
              className="w-full"
            >
              <TabsList className="flex flex-wrap w-full gap-1 p-1">
                {objectiveSections.map(section => {
                  const maxTabsPerRow = 6;
                  const maxWidthPercent = 100 / maxTabsPerRow;
                  
                  return (
                    <TabsTrigger 
                      key={section.key} 
                      value={section.key}
                      className="flex-1 min-w-[140px]"
                      style={{
                        maxWidth: `calc(${maxWidthPercent}% - 4px)`
                      }}
                    >
                      <span className="truncate block w-full text-center">{section.label}</span>
                    </TabsTrigger>
                  );
                })}
                {hasSubjectiveSections && (() => {
                  const maxTabsPerRow = 6;
                  const maxWidthPercent = 100 / maxTabsPerRow;
                  
                  return (
                    <TabsTrigger 
                      key="subjetivas" 
                      value="subjetivas"
                      className="flex-1 min-w-[140px]"
                      style={{
                        maxWidth: `calc(${maxWidthPercent}% - 4px)`
                      }}
                    >
                      <span className="truncate block w-full text-center">Subjetivas</span>
                    </TabsTrigger>
                  );
                })()}
              </TabsList>

              {objectiveSections.map(section => (
                <TabsContent key={section.key} value={section.key}>
                  <AnswerMatrix
                    matrix={section.key === selectedSection ? matrix : []}
                    answers={answers}
                    onAnswerChange={handleAnswerChange}
                    onClearAnswer={handleClearAnswer}
                    getOptionsForQuestion={getOptionsForQuestion}
                    disabled={!canEdit}
                    examType={concurso.exam_type as 'Alternativas' | 'Certo ou Errado'}
                    nullifiedQuestions={nullifiedQuestions}
                  />
                </TabsContent>
              ))}

              {hasSubjectiveSections && (
                <TabsContent key="subjetivas" value="subjetivas">
                  <div className="p-6">
                    <h3 className="text-lg font-semibold text-foreground mb-4">Pontuações Subjetivas</h3>
                    <SubjectScoresTab
                      concurso={concurso}
                      subjectScores={subjectScores}
                      onSubjectScoreChange={handleSubjectScoreChange}
                      canEdit={canEdit}
                    />
                  </div>
                </TabsContent>
              )}
            </Tabs>
          </div>
        </div>
      </CardContent>

      <CardFooter className="p-4 bg-muted/30 border-t border-border">
        <Button
          onClick={handleSaveAnswers}
          className="flex items-center w-full bg-emerald-600 hover:bg-emerald-700 text-white"
          disabled={isSaving || (!canEdit && userRankingData?.edit_count !== undefined)}
          size="lg"
        >
          {isSaving ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Salvando respostas...
            </>
          ) : !canEdit && !isPro && userRankingData?.edit_count !== undefined ? (
            <>
              <AlertTriangle className="h-5 w-5 mr-2" />
              Limite de edições atingido
            </>
          ) : (
            <>
              <Save className="h-5 w-5 mr-2" />
              Salvar Cartão de Respostas
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
};