// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription, usePlanLimits } from '@/modules/payments';
import { useRankingParticipationLimits } from '@/hooks/useRankingParticipationLimits';
import { useToast } from '@/components/ui/use-toast';
import { showProRequiredToast, showRankingParticipationLimitToast } from '@/utils/planRestrictions';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Concurso } from '@/types/concursos';
import { ScoreForm } from './ScoreForm';
import { ArrowDown, PencilLine, CheckCircle, Loader2 } from 'lucide-react';
import { AnswerSheet } from './AnswerSheet';
import { QuotaSelector, QuotaType } from './QuotaSelector';
import { BookletSelector } from './BookletSelector';
import { devLog, sanitizeForLog } from '@/utils/productionLogger';
import { RPCValidator } from '@/utils/rpcValidator';
import { normalizeReservationType } from '@/utils/quotaNormalization';
import { isConsensusMode } from '@/components/Admin/CreateRanking/GabaritoStatusSelector';
interface ExamBooklet {
  id: string;
  name: string;
  display_order: number;
}
interface ParticipationFormProps {
  concurso: Concurso;
  isAlreadyParticipating: boolean;
  userRankingId?: string;
  showAnswerSheet?: boolean;
}
export const ParticipationForm: React.FC<ParticipationFormProps> = ({
  concurso,
  isAlreadyParticipating,
  userRankingId,
  showAnswerSheet: propShowAnswerSheet = false
}) => {
  // Debug log removed to reduce console spam
  
  const {
    user
  } = useAuth();
  const { isPro } = useSubscription();
  const { canParticipateInRanking, participatingInOthersCount, maxParticipationInOthers, isLoading: isLoadingLimits } = usePlanLimits();
  const participationLimits = useRankingParticipationLimits(concurso.id);
  const [isLoading, setIsLoading] = useState(false);
  const [showAnswerSheet, setShowAnswerSheet] = useState(propShowAnswerSheet || true);
  const [showScoreForm, setShowScoreForm] = useState(false);
  const [selectedQuota, setSelectedQuota] = useState<QuotaType>('Ampla Concorrência');
  const quotaCodeMap = React.useMemo<Record<string, string>>(() => ({
    'Ampla Concorrência': 'AC',
    'Ampla': 'AC',
    'AC': 'AC',
    'Pessoas Pretas e Pardas (PPP)': 'PPI',
    'PPP': 'PPI',
    'PPI': 'PPI',
    'Pretos/Pardos/Indígenas': 'PPI',
    'Indígenas': 'PPI',
    'Pessoas com Deficiência': 'PCD',
    'Pessoa com Deficiência': 'PCD',
    'Pessoas com Deficiência (PC)': 'PCD',
    'Pessoa com Deficiência (PCD)': 'PCD',
    'Pessoas com Deficiência (PD)': 'PD',
    'Pessoa com Deficiência (PD)': 'PD',
    'PCD': 'PCD',
    'PC': 'PC',
    'PD': 'PD',
    'Cota PcD': 'PCD',
    'Cota PPI': 'PPI',
    'Cota PC': 'PC',
    'Cota PD': 'PD',
    'Hipossuficientes': 'PC',
    'Pessoas Trans': 'PD'
  }), []);

  // ✅ MAPEAMENTO REVERSO: Converter códigos de volta para nomes completos
  // Isso é necessário porque o sistema espera nomes completos no banco, não códigos
  const quotaCodeToFullName = React.useMemo<Record<string, string>>(() => ({
    'AC': 'Ampla Concorrência',
    'PPI': 'PPP', // PPI (código) -> PPP (nome completo)
    'PCD': 'PCD', // PCD já é o nome completo
    'PC': 'Hipossuficientes', // PC (código) -> Hipossuficientes (nome completo)
    'PD': 'Pessoas Trans' // PD (código) -> Pessoas Trans (nome completo)
    // Nota: 'Indígenas' não precisa de conversão, já é o nome completo esperado
  }), []);
  
  // Debug log para selectedQuota
  // Debug logs removed for security
  const [selectedBooklet, setSelectedBooklet] = useState<string>('');
  const [booklets, setBooklets] = useState<ExamBooklet[]>([]);
  const [isLoadingBooklets, setIsLoadingBooklets] = useState(false);
  const [localIsParticipating, setLocalIsParticipating] = useState(isAlreadyParticipating);
  const [localUserRankingId, setLocalUserRankingId] = useState<string | undefined>(userRankingId);
  const {
    toast
  } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Carregar cadernos disponíveis
  useEffect(() => {
    loadBooklets();
  }, [concurso.id]);

  // Consolidate all prop updates into a single useEffect with memoization
  useEffect(() => {
    // Check URL params to see if we should force display answer sheet
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('showAnswerSheet') === 'true') {
      setShowAnswerSheet(true);
      setShowScoreForm(false);
    } else if (propShowAnswerSheet) {
      setShowAnswerSheet(true);
      setShowScoreForm(false);
    }

    // Update local participation state when prop changes
    setLocalIsParticipating(isAlreadyParticipating);
    setLocalUserRankingId(userRankingId);
  }, [propShowAnswerSheet, isAlreadyParticipating, userRankingId]);

  // Carregar reservation_type existente quando usuário já está participando
  useEffect(() => {
    const loadExistingReservationType = async () => {
      if (isAlreadyParticipating && user?.id && concurso?.id) {
        try {
          const { data: userRankingData } = await supabase
            .from('user_rankings')
            .select('consolidated_data')
            .eq('user_id', user.id)
            .maybeSingle();

          if (userRankingData?.consolidated_data?.rankings) {
            // Procurar pelo ranking deste concurso
            for (const [rankingId, rankingData] of Object.entries(userRankingData.consolidated_data.rankings)) {
              if (rankingData.concurso_id === concurso.id && rankingData.user_data?.reservation_type) {
                // ✅ CORREÇÃO: Converter código do banco (AC, PPI, PCD, etc) para nome completo esperado pelo QuotaType
                const reservationCode = rankingData.user_data.reservation_type;
                const reservationName = normalizeReservationType(reservationCode);
                setSelectedQuota(reservationName as QuotaType);
                break;
              }
            }
          }
        } catch (error) {
          devLog.error('[ParticipationForm] Erro ao carregar reservation_type existente:', error);
        }
      }
    };

    loadExistingReservationType();
  }, [isAlreadyParticipating, user?.id, concurso?.id]);

  // Memoize expensive calculations
  const isUserParticipating = React.useMemo(() => {
    return localIsParticipating || isAlreadyParticipating;
  }, [localIsParticipating, isAlreadyParticipating]);

  const shouldShowAnswerSheet = React.useMemo(() => {
    const result = (showAnswerSheet || isUserParticipating) && localUserRankingId;
    // Debug logs removed for security
    return result;
  }, [showAnswerSheet, isUserParticipating, localUserRankingId, isAlreadyParticipating, localIsParticipating, propShowAnswerSheet]);

  // Debug logs removed for security
  const loadBooklets = async () => {
    try {
      // Debug logs removed for security
      setIsLoadingBooklets(true);
      const { data: concursoData, error } = await supabase
        .from('concursos')
        .select('exam_booklets')
        .eq('id', concurso.id)
        .single();
      
      if (error) throw error;
      
      const booklets = concursoData?.exam_booklets || [];
      // Ordenar por display_order
      const sortedBooklets = booklets.sort((a: any, b: any) => (a.display_order || 0) - (b.display_order || 0));
      
      // Debug logs removed for security
      // Debug logs removed for security
      
      if (sortedBooklets && sortedBooklets.length > 0) {
        setBooklets(sortedBooklets);
        // Se há apenas um caderno, seleciona automaticamente
        if (sortedBooklets.length === 1) {
          // Debug logs removed for security
          setSelectedBooklet(sortedBooklets[0].id);
        }
      } else {
        // Debug logs removed for security
        setBooklets([]);
      }
    } catch (error) {
      devLog.error('Erro ao carregar cadernos:', error);
      setBooklets([]);
    } finally {
      setIsLoadingBooklets(false);
    }
  };
  const validateParticipation = () => {
    // Debug logs removed for security
    // Debug logs removed for security
    // Debug logs removed for security
    // Debug logs removed for security
    
    if (!selectedQuota) {
      // Debug logs removed for security
      toast({
        title: "Cota obrigatória",
        description: "Por favor, selecione uma cota de reserva",
        variant: "destructive"
      });
      return false;
    }

    // Se há múltiplos cadernos, a seleção é obrigatória
    if (booklets.length > 1 && !selectedBooklet) {
      // Debug logs removed for security
      toast({
        title: "Caderno obrigatório",
        description: "Por favor, selecione o caderno da sua prova",
        variant: "destructive"
      });
      return false;
    }
    
    // Debug logs removed for security
    return true;
  };

  const validateBookletHasOfficialAnswers = async (bookletId: string): Promise<boolean> => {
    try {
      // Debug logs removed for security
      
      const { data, error } = await supabase
        .from('concursos')
        .select('official_answers')
        .eq('id', concurso.id)
        .single();

      if (error || !data) {
        // Debug logs removed for security
        return false;
      }

      const bookletData = data?.official_answers?.[bookletId];
      if (!bookletData || !bookletData.answers) {
        // Debug logs removed for security
        return false;
      }

      const questionCount = Object.keys(bookletData.answers).length;
      if (questionCount === 0) {
        // Debug logs removed for security
        return false;
      }

      // Debug logs removed for security
      return true;
    } catch (error) {
      devLog.error('[ParticipationForm] Erro ao verificar gabarito oficial:', error);
      return false;
    }
  };
  const handleParticipate = async () => {
    // handleParticipate called
    if (!user) {
      // No user, redirecting to auth
      toast({
        title: "Login necessário",
        description: "Para participar do ranking, faça login primeiro.",
        variant: "destructive"
      });
      navigate('/auth');
      return;
    }

    // Verificar limites de participação ANTES de validar o formulário
    if (!participationLimits.isLoading && !participationLimits.allowed) {
      if (participationLimits.message) {
        toast({
          title: "Limite atingido",
          description: participationLimits.message,
          variant: "destructive"
        });
      }
      showRankingParticipationLimitToast(navigate);
      return;
    }

    if (!validateParticipation()) {
      // Validation failed
      return;
    }

    // Com gabarito da banca: exige gabarito no caderno. Em consenso, participação é permitida sem gabarito.
    const bookletToValidate = selectedBooklet || (booklets.length === 1 ? booklets[0].id : null);
    if (bookletToValidate && !isConsensusMode(concurso)) {
      const hasOfficialAnswers = await validateBookletHasOfficialAnswers(bookletToValidate);
      if (!hasOfficialAnswers) {
        toast({
          title: "Caderno sem gabarito",
          description: "O caderno selecionado ainda não possui gabarito da banca cadastrado.",
          variant: "destructive"
        });
        return;
      }
    }

    // Starting participation process
    setIsLoading(true);
    try {
      // Verificar se o concurso existe antes de permitir participação
      const { data: rankingExists, error: rankingError } = await supabase
        .from('concursos')
        .select('id')
        .eq('id', concurso.id)
        .single();

      if (rankingError || !rankingExists) {
        toast({
          title: "Erro",
          description: "Ranking não encontrado ou não está ativo.",
          variant: "destructive"
        });
        setIsLoading(false);
        return;
      }

      // Verificar se o usuário já está participando do concurso
      const { data: userRankingData, error: participationError } = await supabase
        .from('user_rankings')
        .select('consolidated_data')
        .eq('user_id', user.id)
        .maybeSingle();

      if (participationError) {
        devLog.error('Erro ao verificar participação:', participationError);
        toast({
          title: "Erro",
          description: "Erro ao verificar participação no ranking.",
          variant: "destructive"
        });
        setIsLoading(false);
        return;
      }

      // Check if user already has this concurso in their consolidated_data
      let isAlreadyParticipating = false;
      if (userRankingData?.consolidated_data?.rankings) {
        Object.values(userRankingData.consolidated_data.rankings).forEach((rankingData: any) => {
          if (rankingData.concurso_id === concurso.id) {
            isAlreadyParticipating = true;
          }
        });
      }

      // ✅ CORREÇÃO: Se já está participando, permitir atualizar apenas o reservation_type
      if (isAlreadyParticipating) {
        // Buscar o ranking_key do ranking existente
        let existingRankingKey: string | null = null;
        if (userRankingData?.consolidated_data?.rankings) {
          for (const [rankingId, rankingData] of Object.entries(userRankingData.consolidated_data.rankings)) {
            if (rankingData.concurso_id === concurso.id) {
              existingRankingKey = rankingId;
              break;
            }
          }
        }

        if (existingRankingKey) {
          // Validar reservation_type
          const reservationCode = quotaCodeMap[selectedQuota] || selectedQuota;
          RPCValidator.validateReservationType(reservationCode);
          const validatedReservationType = selectedQuota;

          // Atualizar apenas o reservation_type usando a função RPC
          const { data: updateResult, error: updateError } = await supabase.rpc('update_ranking_reservation_type', {
            p_user_id: user.id,
            p_ranking_key: existingRankingKey,
            p_new_reservation_type: validatedReservationType
          });

          if (updateError) {
            devLog.error('[ParticipationForm] Erro ao atualizar reservation_type:', updateError);
            toast({
              title: "Erro",
              description: updateError.message || "Erro ao atualizar tipo de reserva.",
              variant: "destructive"
            });
            setIsLoading(false);
            return;
          }

          if (updateResult?.success) {
            toast({
              title: "Cota atualizada",
              description: `Tipo de reserva atualizado para ${selectedQuota}.`,
              variant: "default"
            });
            // Recarregar dados
            queryClient.invalidateQueries({ queryKey: ['userRankings', user.id] });
            queryClient.invalidateQueries({ queryKey: ['rankings', concurso.id] });
            setIsLoading(false);
            return;
          }
        } else {
          toast({
            title: "Erro",
            description: "Não foi possível encontrar o ranking para atualizar.",
            variant: "destructive"
          });
          setIsLoading(false);
          return;
        }
      }

      // Verificar limite de rankings para usuários Free usando a função RPC do backend
      // Isso garante validação consistente e conta apenas rankings que não foram criados pelo usuário
      if (!isPro) {
        const { data: limitsCheck, error: limitsError } = await supabase.rpc('check_free_user_ranking_limits', {
          p_user_id: user.id,
          p_concurso_id: concurso.id
        });

        if (limitsError) {
          devLog.error('[ParticipationForm] Erro ao verificar limites:', limitsError);
          toast({
            title: "Erro",
            description: "Erro ao verificar limites de participação. Tente novamente.",
            variant: "destructive"
          });
          setIsLoading(false);
          return;
        }

        if (limitsCheck && !limitsCheck.allowed) {
          setIsLoading(false);
          if (limitsCheck.message) {
            toast({
              title: "Limite atingido",
              description: limitsCheck.message,
              variant: "destructive"
            });
          } else {
            showRankingParticipationLimitToast(navigate);
          }
          return;
        }
      }

      // Inicializar object_scores baseado nas seções habilitadas do concurso
      // Considera tanto campos diretos quanto JSONB disciplines
      const initializeSubjectScores = (concurso: any) => {
        const subjectScores: Record<string, number> = {};
        
        // 1. Verificar campos diretos (sistema legacy)
        if (concurso.has_discursive) subjectScores.discursive = 0;
        if (concurso.has_case_study_1) subjectScores.case_study_1 = 0;
        if (concurso.has_case_study_2) subjectScores.case_study_2 = 0;
        if (concurso.has_case_study_3) subjectScores.case_study_3 = 0;
        if (concurso.has_other_subjective) subjectScores.other_subjective = 0;
        
        // 2. Verificar JSONB disciplines (sistema atual)
        if (concurso.disciplines) {
          // Verificar nova estrutura hierárquica (objeto com blocks)
          if (typeof concurso.disciplines === 'object' && !Array.isArray(concurso.disciplines) && concurso.disciplines.blocks) {
            for (const block of concurso.disciplines.blocks) {
              if (block.disciplines && Array.isArray(block.disciplines)) {
                for (const discipline of block.disciplines) {
                  if (discipline.isEnabled) {
                    switch (discipline.type) {
                      case 'discursive':
                        subjectScores.discursive = 0;
                        break;
                      case 'case_study_1':
                        subjectScores.case_study_1 = 0;
                        break;
                      case 'case_study_2':
                        subjectScores.case_study_2 = 0;
                        break;
                      case 'case_study_3':
                        subjectScores.case_study_3 = 0;
                        break;
                      case 'other_subjective':
                        subjectScores.other_subjective = 0;
                        break;
                      default:
                        // Disciplinas customizadas
                        if (discipline.id) {
                          subjectScores[`custom_${discipline.id}`] = 0;
                        }
                        break;
                    }
                  }
                }
              }
            }
          }
          // Verificar estrutura antiga (array de blocos)
          else if (Array.isArray(concurso.disciplines)) {
            for (const discipline of concurso.disciplines) {
              if ('disciplines' in discipline) {
                // Estrutura hierárquica (blocos)
                if (discipline.disciplines && Array.isArray(discipline.disciplines)) {
                  for (const d of discipline.disciplines) {
                    if (d.isEnabled) {
                      switch (d.type) {
                        case 'discursive':
                          subjectScores.discursive = 0;
                          break;
                        case 'case_study_1':
                          subjectScores.case_study_1 = 0;
                          break;
                        case 'case_study_2':
                          subjectScores.case_study_2 = 0;
                          break;
                        case 'case_study_3':
                          subjectScores.case_study_3 = 0;
                          break;
                        case 'other_subjective':
                          subjectScores.other_subjective = 0;
                          break;
                        default:
                          // Disciplinas customizadas
                          if (d.id) {
                            subjectScores[`custom_${d.id}`] = 0;
                          }
                          break;
                      }
                    }
                  }
                }
              } else {
                // Estrutura plana
                if (discipline.isEnabled) {
                  switch (discipline.type) {
                    case 'discursive':
                      subjectScores.discursive = 0;
                      break;
                    case 'case_study_1':
                      subjectScores.case_study_1 = 0;
                      break;
                    case 'case_study_2':
                      subjectScores.case_study_2 = 0;
                      break;
                    case 'case_study_3':
                      subjectScores.case_study_3 = 0;
                      break;
                    case 'other_subjective':
                      subjectScores.other_subjective = 0;
                      break;
                    default:
                      // Disciplinas customizadas
                      if (discipline.id) {
                        subjectScores[`custom_${discipline.id}`] = 0;
                      }
                      break;
                  }
                }
              }
            }
          }
        }
        
        return subjectScores;
      };

      // Generate a unique ranking ID
      const rankingId = `ranking_${concurso.id}_${user.id}_${Date.now()}`;
      
      // Create the new ranking data structure with correct format and order
      const newRankingData = {
        user_data: {
          score: 0,  // Total geral (objetivas + subjetivas)
          answers: {},
          subject_scores_tot: 0,  // Total das objetivas - ANTES de object_scores
          object_scores: (() => {
            // Criar subject_scores dinamicamente baseado nas disciplinas do concurso
            const subjectScores: Record<string, number> = {};
            if (concurso.disciplines && Array.isArray(concurso.disciplines)) {
              for (const block of concurso.disciplines) {
                if ('disciplines' in block && Array.isArray(block.disciplines)) {
                  for (const discipline of block.disciplines) {
                    if (discipline.isEnabled && discipline.type && discipline.type.startsWith('custom_')) {
                      subjectScores[discipline.type] = 0;
                    }
                  }
                }
              }
            }
            return subjectScores;
          })(),
          subjective_scores: 0,  // Soma das subjetivas - ANTES de subjectives
          subjectives: {
            "discursive": 0,
            "case_study_1": 0,
            "case_study_2": 0,
            "case_study_3": 0,
            "other_subjective": 0
          },
          all_questions_answered: false,
          reservation_type: selectedQuota  // ✅ Usar selectedQuota diretamente (já é o nome completo)
        },
        concurso_id: concurso.id,
        control_metadata: {
          created_at: new Date().toISOString(),
          edit_history: [],
          last_updated: new Date().toISOString(),
          is_score_recalculated: false
        },
        selected_booklet_id: booklets.length > 0 ? (selectedBooklet as string || booklets[0].id) : null,
        edit_count: 0
      };

      // ✅ VALIDAÇÃO: Validar inputs antes de enviar
      let validatedConcursoId: string;
      let validatedReservationType: string;
      let validatedBookletId: string | null;
      let validatedRankingData: any;
      
      devLog.log('[ParticipationForm] Iniciando validação de inputs para participate_in_ranking...');
      devLog.log('[ParticipationForm] Dados recebidos:', {
        concursoId: concurso.id?.substring(0, 8) + '...',
        selectedQuota,
        selectedBooklet,
        bookletsCount: booklets.length,
        newRankingDataKeys: Object.keys(newRankingData || {})
      });
      
      try {
        devLog.log('[ParticipationForm] Validando concursoId...');
        validatedConcursoId = RPCValidator.validateUUID(concurso.id, 'ID do concurso');
        devLog.log('[ParticipationForm] concursoId validado');
        
        devLog.log('[ParticipationForm] Validando reservationType...');
        // ✅ CORREÇÃO: Garantir que selectedQuota não seja null/undefined
        if (!selectedQuota || selectedQuota === '') {
          throw new Error('Tipo de reserva não selecionado. Por favor, selecione uma cota.');
        }
        
        const reservationCode = quotaCodeMap[selectedQuota] || selectedQuota;
        
        // ✅ CORREÇÃO: Validar o código, mas usar o nome completo original para salvar
        // O sistema espera nomes completos no banco (PPP, PCD, Hipossuficientes, Indígenas, Pessoas Trans)
        // A validação usa códigos (PPI, PC, PD) apenas para verificar se é válido
        RPCValidator.validateReservationType(reservationCode); // Apenas validar, não usar o retorno
        
        // ✅ CORREÇÃO: Usar o selectedQuota diretamente (já é o nome completo correto)
        // Garantir que não seja null
        validatedReservationType = selectedQuota || 'Ampla Concorrência';
        devLog.log('[ParticipationForm] reservationType validado e usando nome completo:', validatedReservationType);
        
        devLog.log('[ParticipationForm] Validando bookletId...');
        validatedBookletId = RPCValidator.validateBookletId(
          booklets.length > 0 ? (selectedBooklet as string || booklets[0].id) : null
        );
        devLog.log('[ParticipationForm] bookletId validado:', validatedBookletId);
        
        devLog.log('[ParticipationForm] Validando rankingData...');
        validatedRankingData = RPCValidator.validateRankingData(newRankingData);
        validatedRankingData = {
          ...validatedRankingData,
          user_data: {
            ...(validatedRankingData.user_data || newRankingData.user_data || {}),
            reservation_type: validatedReservationType,
          },
        };
        devLog.log('[ParticipationForm] rankingData validado');
        
        devLog.log('[ParticipationForm] ✅ Todas as validações passaram');
      } catch (validationError: any) {
        devLog.error('[ParticipationForm] ❌ ERRO DE VALIDAÇÃO:', {
          message: validationError.message,
          stack: validationError.stack,
          error: validationError
        });
        toast({
          title: "Erro de validação",
          description: validationError.message || "Dados inválidos. Verifique os campos e tente novamente.",
          variant: "destructive"
        });
        setIsLoading(false);
        return;
      }

      // ✅ USAR FUNÇÃO RPC COM VALIDAÇÃO NO BACKEND
      const rpcParams = {
        p_concurso_id: validatedConcursoId,
        p_reservation_type: validatedReservationType,
        p_selected_booklet_id: validatedBookletId,
        p_ranking_data: validatedRankingData
      };
      
      devLog.log('[ParticipationForm] Chamando RPC participate_in_ranking com parâmetros:', {
        p_concurso_id: rpcParams.p_concurso_id.substring(0, 8) + '...',
        p_reservation_type: rpcParams.p_reservation_type,
        p_selected_booklet_id: rpcParams.p_selected_booklet_id,
        p_ranking_data_reservation_type: rpcParams.p_ranking_data?.user_data?.reservation_type,
        selectedQuota: selectedQuota,
        validatedReservationType: validatedReservationType
      });
      
      const { data: participateResult, error: participateError } = await supabase.rpc('participate_in_ranking', rpcParams);
      
      if (participateError) {
        devLog.error('[ParticipationForm] ❌ ERRO na chamada RPC:', {
          error: participateError,
          message: participateError.message,
          details: participateError.details,
          hint: participateError.hint,
          code: participateError.code
        });
      } else {
        devLog.log('[ParticipationForm] ✅ RPC chamado com sucesso:', { result: participateResult });
      }

      if (participateError) {
        throw participateError;
      }

      if (!participateResult || !participateResult.success) {
        const errorMessage = participateResult?.error || 'Erro ao participar do ranking';
        toast({
          title: "Erro",
          description: errorMessage,
          variant: "destructive"
        });
        setIsLoading(false);
        return;
      }

      // Usar ranking_key retornado pela função RPC
      const finalRankingId = participateResult.ranking_key || rankingId;
      // Invalidar todas as queries relacionadas para garantir atualização automática
      // Debug logs removed for security
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['participating', concurso.id, user.id]
        }),
        queryClient.invalidateQueries({
          queryKey: ['concursos', concurso.id]
        }),
        queryClient.invalidateQueries({
          queryKey: ['concurso', concurso.id]
        }),
        // ✅ ADICIONAR: invalidação para nova estrutura
        queryClient.invalidateQueries({
          queryKey: ['participant-count-v2', concurso.id]
        }),
        queryClient.invalidateQueries({
          queryKey: ['user-participation-v2', concurso.id, user.id]
        }),
        queryClient.invalidateQueries({
          queryKey: ['concursos-pagination', concurso.id]
        }),
        // ✅ ADICIONAR: invalidação para rankings
        queryClient.invalidateQueries({
          queryKey: ['rankings', concurso.id]
        }),
        queryClient.invalidateQueries({
          queryKey: ['rankings']
        })
      ]);
      // Debug logs removed for security
      toast({
        title: "Inscrição iniciada!",
        description: "Preencha o cartão de respostas para participar oficialmente do ranking."
      });

      // Em vez de recarregar, mostrar o AnswerSheet diretamente
      // Participation successful
      setLocalUserRankingId(finalRankingId); // ✅ Usar o ranking_key retornado pela função RPC
      setLocalIsParticipating(true);
      setShowAnswerSheet(true);
      setIsLoading(false);
      // States updated - should show AnswerSheet now
    } catch (error: any) {
      setIsLoading(false);
      devLog.error('Error joining ranking:', error);
      toast({
        title: "Erro ao participar",
        description: error.message || "Não foi possível completar sua inscrição. Tente novamente.",
        variant: "destructive"
      });
    }
  };
  if (!user) {
    return <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
        <h2 className="text-xl font-bold mb-4">Participe do Ranking</h2>
        <p className="mb-4">Faça login para participar do ranking deste concurso.</p>
        <Button onClick={() => navigate('/auth')} className="bg-emerald-600 hover:bg-emerald-700">
          Fazer Login
        </Button>
      </div>;
  }

  // Debug logs para entender o estado
  // Debug states log removed to reduce console spam

  // Show the answer sheet if selected and we have a ranking ID
  // Debug logs removed for security
  if (shouldShowAnswerSheet) {
    // Debug logs removed for security
    // Rendering AnswerSheet
    return (
      <div className="w-full h-full">
        <AnswerSheet concurso={concurso} rankingId={localUserRankingId} onSuccess={() => {
          setLocalIsParticipating(true);
          setShowAnswerSheet(false);
          queryClient.invalidateQueries({
            queryKey: ['concursos', concurso.id]
          });
          navigate(`/concurso/${concurso.id}/resultados`);
          toast({
            title: "Cartão de Respostas Processado",
            description: "Suas respostas foram processadas e seu ranking foi atualizado."
          });
        }} />
      </div>
    );
  }

  // Default view for non-participating users
  return (
    <div className="p-6 rounded-lg shadow-sm border border-border bg-muted/30">
      <h2 className="text-xl font-bold mb-4">Participe do Ranking</h2>
      
      
      <div className="space-y-4">
        {/* Quota selection component */}
        <QuotaSelector concurso={concurso} selectedQuota={selectedQuota} onQuotaChange={setSelectedQuota} />
        
        {/* Booklet selection (always show if booklets available) */}
        {isLoadingBooklets ? <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando cadernos...
          </div> : booklets.length > 0 ? <BookletSelector booklets={booklets} selectedBooklet={selectedBooklet} onBookletChange={setSelectedBooklet} required={booklets.length > 1} /> : <div className="text-sm text-muted-foreground">Nenhum caderno disponível</div>}
      </div>
      
      <Button onClick={() => {
        // Button clicked
        handleParticipate();
      }} disabled={isLoading || isLoadingBooklets} className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700">
        {isLoading ? <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 
            Processando...
          </> : 'Participar do Ranking'}
      </Button>
    </div>
  );
};