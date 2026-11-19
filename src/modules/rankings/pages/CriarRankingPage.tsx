import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Form } from '@/components/ui/form';
import { GeneralTab } from '@/components/Admin/CreateRanking/GeneralTab';
import { AnswerKeyTab } from '@/components/Admin/CreateRanking/AnswerKeyTab';
import { GeneralCardForm } from '@/components/Admin/CreateRanking/GeneralCardForm';
import { supabase } from '@/integrations/supabase/client';
import { useSaveRanking } from '@/modules/rankings/hooks/useSaveRanking';
import { resolveSaveRankingOutcome } from '@/modules/rankings/domain/saveRankingResult';
import { useEditUrls } from '@/hooks/useEditUrls';
import { usePlanLimits } from '@/modules/payments';
import { ProFeatureGuard } from '@/components/Subscription/ProFeatureGuard';
import { AdminUrlObfuscationService } from '@/services/adminUrlObfuscation';
import { devLog } from '@/utils/productionLogger';
import { openRankingAfterCreate } from '@/modules/rankings';
const fetchRankingData = async rankingId => {
  if (!rankingId) return null;
  try {
    const {
      data,
      error
    } = await supabase.from('concursos').select('*').eq('id', rankingId).single();
    if (error) {
      // Debug logs removed for security
      throw error;
    }
    return data;
  } catch (error) {
    // Debug logs removed for security
    return null;
  }
};
const CriarRankingPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    user
  } = useAuth();
  const queryClient = useQueryClient();
  const { validateEditToken } = useEditUrls();
  const { canCreateRanking, maxRankings, currentRankingCount, isPro, isLoading: isLoadingLimits } = usePlanLimits();
  const [activeTab, setActiveTab] = useState('general-info');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCustomTitle, setIsCustomTitle] = useState(false);
  const [isCustomBanca, setIsCustomBanca] = useState(false);
  const [createdConcursoId, setCreatedConcursoId] = useState<string | null>(null);
  const [selectedStates, setSelectedStates] = useState<string[]>([]);
  const [isValidatingToken, setIsValidatingToken] = useState(false);
  const [isEditingGeneralCard, setIsEditingGeneralCard] = useState(false);
  const searchParams = new URLSearchParams(location.search);
  const editToken = searchParams.get('edit');
  const { isAdmin } = useAdminAuth();
  const parentId = searchParams.get('parent');
  const stateUf = searchParams.get('state'); // Estado para concursos unificados
  const [jobTitles] = useState([{
    id: '1',
    title: 'TCU'
  }, {
    id: '2',
    title: 'CGU'
  }, {
    id: '3',
    title: 'INSS'
  }, {
    id: '4',
    title: 'CNU'
  }, {
    id: '5',
    title: 'SENADO FEDERAL'
  }, {
    id: '6',
    title: 'CÂMARA DOS DEPUTADOS'
  }, {
    id: '7',
    title: 'POLICIA FEDERAL'
  }, {
    id: '8',
    title: 'POLICIA RODOVIARIA FEDERAL'
  }, {
    id: '9',
    title: 'OUTRO'
  }]);
  const form = useForm({
    defaultValues: {
      predefined_job_title: '',
      custom_job_title: '',
      titulo: '',
      orgao: '',
      banca: '',
      custom_banca: '',
      created_at: new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0],
      etapa_atual: 'Prova Objetiva',
      status: 'Em andamento',
      link: '',
      vagas: 0,
      inscritos: 0,
      exam_type: 'Alternativas',
      alternatives_count: 5,
      wrong_answer_penalty: 0,
      has_basic_knowledge: true,
      basic_knowledge_questions: 0,
      basic_knowledge_weight: 1,
      has_specific_knowledge_1: false,
      specific_knowledge_1_questions: 0,
      specific_knowledge_1_weight: 1,
      has_specific_knowledge_2: false,
      specific_knowledge_2_questions: 0,
      specific_knowledge_2_weight: 1,
      has_specific_knowledge_3: false,
      specific_knowledge_3_questions: 0,
      specific_knowledge_3_weight: 1,
      has_discursive: false,
      has_case_study_1: false,
      has_case_study_2: false,
      has_case_study_3: false,
      has_other_subjective: false,
      other_subjective_name: '',
      // Pontuação mínima geral
      has_minimum_score: false,
      minimum_score_unit_type: 'percentage',
      total_minimum_score: 0,
      // Pontuação mínima para cotas
      has_quota_minimum_score: false,
      quota_minimum_score: 0,
      quota_minimum_score_unit_type: 'percentage',
      // Notas mínimas para questões subjetivas
      discursive_minimum_score: 0,
      case_study_1_minimum_score: 0,
      case_study_2_minimum_score: 0,
      case_study_3_minimum_score: 0,
      other_subjective_minimum_score: 0,
      // Notas mínimas para cotas das questões subjetivas
      discursive_minimum_score_cotas: 0,
      case_study_1_minimum_score_cotas: 0,
      case_study_2_minimum_score_cotas: 0,
      case_study_3_minimum_score_cotas: 0,
      other_subjective_minimum_score_cotas: 0,
      // Estrutura de disciplinas (inicializada vazia)
      disciplines: [],
      has_ampla_concorrencia: true,
      has_ppp: false,
      has_pcd: false,
      has_hipossuficientes: false,
      has_indigenas: false,
      has_transsexuais: false,
      localidades: [],
      watermark_image_url: '',
      // Campos de hierarquia
      ranking_type: parentId ? 'position' : 'general',
      parent_concurso_id: parentId || null,
      is_general_card: !parentId,
      cargo: null,
      is_unified: false,
      state_uf: stateUf || null
    }
  });

  // Validar token de edição se presente
  useEffect(() => {
    const validateEditTokenAsync = async () => {
      if (editToken) {
        setIsValidatingToken(true);
        try {
          const validConcursoId = await validateEditToken(editToken);
          if (validConcursoId) {
            // Token válido, continuar com a edição
            setCreatedConcursoId(validConcursoId);
          } else {
            // Token inválido ou expirado
            toast.error('Link de edição inválido ou expirado');
            navigate('/criar-ranking');
          }
        } catch (error) {
          devLog.error('Erro ao validar token de edição:', error);
          toast.error('Erro ao validar link de edição');
          navigate('/criar-ranking');
        } finally {
          setIsValidatingToken(false);
        }
      }
    };

    validateEditTokenAsync();
  }, [editToken, validateEditToken, navigate]);

  useEffect(() => {
    const loadExistingData = async () => {
      if (editToken) {
        try {
          const data = await fetchRankingData(createdConcursoId);
          if (data) {
            setCreatedConcursoId(data.id);
            
            // ✅ VERIFICAR SE É CARD GERAL
            // Se tem parent_concurso_id, NÃO é card geral (é card de cargo)
            const isGeneral = data.is_general_card === true && !data.parent_concurso_id;
            setIsEditingGeneralCard(isGeneral);
            
            // Se for card geral, carregar apenas dados básicos
            if (isGeneral) {
              const isOtherTitle = !jobTitles.find(jt => jt.title === data.titulo);
              setIsCustomTitle(isOtherTitle);
              const isOtherBanca = data.banca === 'OUTRO' || !['Cebraspe', 'FGV', 'VUNESP', 'FCC', 'FUNDATEC'].includes(data.banca);
              setIsCustomBanca(isOtherBanca);
              
              // Configurar as localidades para card geral
              if (data.localidades && Array.isArray(data.localidades)) {
                setSelectedStates(data.localidades);
              }
              
              // Carregar apenas dados básicos para card geral
              const formData = {
                ...data,
                predefined_job_title: isOtherTitle ? 'OUTRO' : data.titulo,
                custom_job_title: isOtherTitle ? data.titulo : '',
                banca: isOtherBanca ? 'OUTRO' : data.banca,
                custom_banca: isOtherBanca ? data.banca : '',
                orgao: data.orgao,
                created_at: data.created_at ? new Date(new Date(data.created_at).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0] : new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0],
                vagas: data.vagas || 0,
                inscritos: data.inscritos || 0,
                etapa_atual: data.etapa_atual || 'Prova Objetiva',
                watermark_image_url: data.watermark_image_url || '',
                link: data.link || '',
                ranking_type: 'general',
                is_general_card: true,
                parent_concurso_id: null,
                cargo: null,
                is_unified: data.is_unified || false,
                state_uf: null,
                status: data.status || 'Em andamento',
                localidades: data.localidades || []
              };
              
              form.reset(formData);
              return; // Sair cedo, não carregar dados de disciplinas/cotas
            }
            
            // Se for card de cargo, carregar todos os dados normalmente
            const isOtherTitle = !jobTitles.find(jt => jt.title === data.titulo);
            setIsCustomTitle(isOtherTitle);
            const isOtherBanca = data.banca === 'OUTRO' || !['Cebraspe', 'FGV', 'VUNESP', 'FCC', 'FUNDATEC'].includes(data.banca);
            setIsCustomBanca(isOtherBanca);

            // Configurar as localidades
            if (data.localidades && Array.isArray(data.localidades)) {
              setSelectedStates(data.localidades);
            }
            // Mapear dados das cotas do JSONB para os campos do formulário
            const quotaData = data.has_cota || {};
            const subjectsData = data.subjects || {};
            
            // ✅ Extrair minimum scores e blocos da nova estrutura JSONB
            let minimumTotalScore = 0;
            let minimumTotalScoreCotas = 0;
            let wrongAnswerPenalty = 0;
            let disciplinesBlocks = [];
            
            if (data.disciplines) {
              // Nova estrutura: campos no nível raiz com array blocks
              if (data.disciplines.minimum_total_score !== undefined) {
                minimumTotalScore = data.disciplines.minimum_total_score || 0;
              }
              if (data.disciplines.minimum_total_score_cotas !== undefined) {
                minimumTotalScoreCotas = data.disciplines.minimum_total_score_cotas || 0;
              }
              if (data.disciplines.wrong_answer_penalty !== undefined) {
                wrongAnswerPenalty = data.disciplines.wrong_answer_penalty || 0;
              }
              if (data.disciplines.blocks && Array.isArray(data.disciplines.blocks)) {
                // Converter estrutura JSONB para o formato esperado pelo form
                disciplinesBlocks = data.disciplines.blocks.map((b: any) => ({
                  id: b.blockId ?? b.id,
                  name: b.blockName ?? b.name,
                  minimum_score: Number(b.blockMinimumScore ?? b.minimum_score ?? 0),
                  minimum_score_cotas: Number(b.blockMinimumCotas ?? b.minimum_score_cotas ?? 0),
                  disciplines: (b.disciplines || []).map((d: any) => ({
                    ...d,
                    minimum_score: Number(d.minimum_score || 0),
                    minimum_score_cotas: Number(d.minimum_score_cotas || 0),
                    weight: Number(d.weight || 1),
                    questionCount: Number(d.questionCount || 0),
                    isEnabled: d.isEnabled !== false
                  }))
                }));
              }
              
              // Debug logs removed for security
            }
            
            // Verificar se é card de cargo (tem parent_concurso_id)
            const isPositionCard = !!data.parent_concurso_id;
            
            // Se for cargo, carregar dados do parent para exibição
            if (isPositionCard && data.parent_concurso_id) {
              try {
                const { data: parentData } = await supabase
                  .from('concursos')
                  .select('id, titulo, orgao, banca, is_unified')
                  .eq('id', data.parent_concurso_id)
                  .single();
                
                // Os dados do parent serão carregados automaticamente pelo BasicInfoSection
                // através do useEffect que monitora parent_concurso_id
              } catch (error) {
                devLog.error('Erro ao carregar parent:', error);
              }
            }
            
            // Criar objeto de dados para o formulário
            const formData = {
              ...data,
              localidades: data.localidades || [],
              // ✅ GARANTIR que campos de hierarquia estejam corretos para card de cargo
              ranking_type: isPositionCard ? 'position' : 'general',
              is_general_card: isPositionCard ? false : (data.is_general_card || false),
              parent_concurso_id: isPositionCard ? data.parent_concurso_id : null,
              cargo: isPositionCard ? data.cargo : null,
              is_unified: isPositionCard ? false : (data.is_unified || false),
              state_uf: isPositionCard ? data.state_uf : null,
              // Para card de cargo, não preencher esses campos (vêm do parent)
              // Para card geral, preencher normalmente
              predefined_job_title: isPositionCard ? '' : (isOtherTitle ? 'OUTRO' : data.titulo),
              custom_job_title: isPositionCard ? '' : (isOtherTitle ? data.titulo : ''),
              banca: isPositionCard ? '' : (isOtherBanca ? 'OUTRO' : data.banca),
              custom_banca: isPositionCard ? '' : (isOtherBanca ? data.banca : ''),
              // Para card de cargo, o campo 'orgao' não deve ser preenchido (vem do parent)
              orgao: isPositionCard ? '' : data.orgao,
              created_at: data.created_at ? new Date(new Date(data.created_at).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0] : new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0],
              // Campos básicos do concurso
              vagas: data.vagas || 0,
              inscritos: data.inscritos || 0,
              etapa_atual: data.etapa_atual || 'Prova Objetiva',
              watermark_image_url: data.watermark_image_url || '',
              link: data.link || '',
              // Mapear cotas do JSONB para campos do formulário
              has_ampla_concorrencia: true, // Sempre true
              has_ppp: quotaData.ppp === true,
              has_pcd: quotaData.pcd === true,
              has_hipossuficientes: quotaData.hip === true,
              has_indigenas: quotaData.ind === true,
              has_transsexuais: quotaData.tra === true,
              
              // ✅ Minimum scores globais da nova estrutura JSONB
              minimumTotalScore: minimumTotalScore,
              minimumTotalScoreCotas: minimumTotalScoreCotas,
              wrong_answer_penalty: wrongAnswerPenalty,
              
              // ✅ Blocos de disciplinas da nova estrutura JSONB
              disciplines: disciplinesBlocks,
              
              // Mapear disciplinas subjetivas do JSONB
              has_discursive: subjectsData.discr === true,
              has_case_study_1: subjectsData.case1 === true,
              has_case_study_2: subjectsData.case2 === true,
              has_case_study_3: subjectsData.case3 === true,
              has_other_subjective: subjectsData.other === true,
              other_subjective_name: subjectsData.name_other || '',
              discursive_minimum_score: subjectsData.discr_min_score || 0,
              case_study_1_minimum_score: subjectsData.case1_min_score || 0,
              case_study_2_minimum_score: subjectsData.case2_min_score || 0,
              case_study_3_minimum_score: subjectsData.case3_min_score || 0,
              other_subjective_minimum_score: subjectsData.other_min_score || 0,
              // ✅ Mapear valores das cotas das subjetivas do JSONB
              discursive_minimum_score_cotas: subjectsData.discr_min_score_cotas || 0,
              case_study_1_minimum_score_cotas: subjectsData.case1_min_score_cotas || 0,
              case_study_2_minimum_score_cotas: subjectsData.case2_min_score_cotas || 0,
              case_study_3_minimum_score_cotas: subjectsData.case3_min_score_cotas || 0,
              other_subjective_minimum_score_cotas: subjectsData.other_min_score_cotas || 0
            };
            
            
            form.reset(formData);
            
          }
        } catch (error) {
          devLog.error('Error loading existing ranking data:', error);
          toast.error('Erro ao carregar dados do ranking');
        }
      }
    };
    loadExistingData();
  }, [createdConcursoId, form, jobTitles, editToken]);
  useEffect(() => {
    if (!user) {
      toast.error('Você precisa estar logado para criar um ranking');
      navigate('/auth');
    }
  }, [user, navigate]);
  const handleJobTitleChange = (value: string) => {
    setIsCustomTitle(value === 'OUTRO');
    if (value !== 'OUTRO') {
      form.setValue('titulo', value.toUpperCase());
    }
  };
  const handleCustomTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    form.setValue('titulo', e.target.value.toUpperCase());
  };
  const handleBancaChange = (value: string) => {
    setIsCustomBanca(value === 'OUTRO');
    if (value !== 'OUTRO') {
      form.setValue('banca', value);
    }
  };
  const handleOrgaoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    form.setValue('orgao', e.target.value.toUpperCase());
  };
  // Determinar se é card geral ou cargo
  const isGeneralCard = (!parentId && !editToken) || isEditingGeneralCard;
  const isPositionCard = !!parentId;

  const { 
    saveRanking
  } = useSaveRanking();
  
  // Handler específico para salvar card geral (simplificado)
  const handleSaveGeneralCard = async () => {
    const formValues = form.getValues();
    const rankingType = formValues.ranking_type || 'general';
    
    if (rankingType !== 'general') {
      toast.error('Este formulário é apenas para criar card geral');
      return;
    }

    // Validações básicas
    if (!formValues.banca) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    // Sincronizar os estados selecionados com o formulário antes de salvar
    form.setValue('localidades', selectedStates, {
      shouldDirty: true
    });
    const finalLocalidades = selectedStates.length > 0 ? selectedStates : (formValues.localidades || []);

    setIsSubmitting(true);
    try {
      const saveResult = await saveRanking({
        formValues: {
          ...formValues,
          ranking_type: 'general',
          is_general_card: true,
          parent_concurso_id: null,
          cargo: null,
          // Campos mínimos necessários para salvar
          status: formValues.status || 'Em andamento',
          etapa_atual: formValues.etapa_atual || 'Prova Objetiva',
          exam_type: 'Alternativas', // Valor padrão
          alternatives_count: 5, // Valor padrão
          // Estrutura vazia (será preenchida ao criar cargos)
          disciplines: [],
          has_cota: {},
          subjects: {},
          localidades: finalLocalidades, // ✅ Usar selectedStates ou formValues.localidades
          has_ampla_concorrencia: true,
          has_ppp: false,
          has_pcd: false,
          has_hipossuficientes: false,
          has_indigenas: false,
          has_transsexuais: false
        },
        userId: user?.id,
        editId: editToken ? createdConcursoId : null, // ✅ Usar createdConcursoId se estiver editando
        jobTitles
      });

      const outcome = resolveSaveRankingOutcome(saveResult);
      if (!outcome.ok) {
        toast.error(outcome.message);
        return;
      }

      toast.success(editToken ? 'Card geral atualizado com sucesso!' : 'Card geral criado com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['rankings'] });
      if (!editToken) {
        try {
          const { UrlObfuscationService } = await import('@/services/urlObfuscation');
          const secureUrl = await UrlObfuscationService.generateSecureCargosUrl(outcome.id);
          navigate(secureUrl);
        } catch (error) {
          devLog.error('Erro ao gerar URL segura:', error);
          navigate(`/pre-classificacao/${outcome.id}/cargos`);
        }
      }
      return;
    } catch (error) {
      devLog.error("Erro ao salvar card geral:", error);
      toast.error("Erro ao salvar card geral: " + (error as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveRanking = async (): Promise<string | null> => {
    // Debug logs removed for security
    const formValues = form.getValues();
    // Debug logs removed for security

    // Sincronizar os estados selecionados com o formulário
    form.setValue('localidades', selectedStates, {
      shouldDirty: true
    });
    formValues.localidades = selectedStates;

    // Adicionar flags de admin se necessário
    if (isAdmin) {
      const formValuesWithAdminFlags = {
        ...formValues,
        is_admin_created: true,
        is_admin_update: true
      };
      setIsSubmitting(true);
      try {
        const saveResult = await saveRanking({
          formValues: formValuesWithAdminFlags,
          userId: user?.id,
          editId: createdConcursoId,
          jobTitles
        });
        const outcome = resolveSaveRankingOutcome(saveResult);
        if (!outcome.ok) {
          toast.error(outcome.message);
          return null;
        }
        setCreatedConcursoId(outcome.id);
        queryClient.invalidateQueries({ queryKey: ['exam-booklets'] });
        return outcome.id;
      } catch (error) {
        devLog.error("Erro ao salvar ranking:", error);
        toast.error("Erro ao salvar ranking: " + (error as Error).message);
        return null;
      } finally {
        setIsSubmitting(false);
      }
    } else {
      setIsSubmitting(true);
      try {
        const saveResult = await saveRanking({
          formValues,
          userId: user?.id,
          editId: createdConcursoId,
          jobTitles
        });
        const outcome = resolveSaveRankingOutcome(saveResult);
        if (!outcome.ok) {
          toast.error(outcome.message);
          return null;
        }
        setCreatedConcursoId(outcome.id);
        queryClient.invalidateQueries({ queryKey: ['exam-booklets'] });
        return outcome.id;
      } catch (error) {
        devLog.error("Erro ao salvar ranking:", error);
        toast.error("Erro ao salvar ranking: " + (error as Error).message);
        return null;
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleNextTab = () => {
    setActiveTab('answer-key');
  };

  const handleGoToResults = () => {
    if (createdConcursoId) {
      openRankingAfterCreate(navigate, createdConcursoId);
    }
  };
  const handleBack = async () => {
    if (isAdmin && user?.id) {
      try {
        const url = await AdminUrlObfuscationService.generateSecureConcursosUrl(user.id);
        navigate(url);
      } catch {
        navigate('/internal/console/concursos');
      }
      return;
    }

    navigate('/pre-classificacao');
  };

  // Mostrar loading enquanto valida o token de edição
  if (isValidatingToken) {
    return (
      <div className="container mx-auto p-4">
        <div className="flex justify-center items-center py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
            <p>Validando link de edição...</p>
          </div>
        </div>
      </div>
    );
  }

  // Verificar limite de rankings (apenas se não for edição/admin) - DEPOIS de todos os hooks
  if (!editToken && !isAdmin && !isLoadingLimits && !canCreateRanking) {
    return (
      <div className="container mx-auto p-4">
        <ProFeatureGuard
          featureName="Criar Ranking"
        />
      </div>
    );
  }

  // Se for card geral (criação ou edição), mostrar formulário simplificado
  if (isGeneralCard && (!editToken || isEditingGeneralCard)) {
    return (
      <div className="page-content-container">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl font-bold">
              {editToken ? 'Editar Card Geral' : 'Criar Card Geral'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={e => e.preventDefault()}>
                <GeneralCardForm
                  form={form}
                  jobTitles={jobTitles}
                  isCustomTitle={isCustomTitle}
                  isCustomBanca={isCustomBanca}
                  handleJobTitleChange={handleJobTitleChange}
                  handleCustomTitleChange={handleCustomTitleChange}
                  handleBancaChange={handleBancaChange}
                  handleOrgaoChange={handleOrgaoChange}
                  onSave={handleSaveGeneralCard}
                  isSubmitting={isSubmitting}
                  selectedStates={selectedStates}
                  setSelectedStates={setSelectedStates}
                />
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Se for cargo ou edição, mostrar formulário completo
  return (
    <div className="page-content-container">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold">
            {editToken ? 'Editar Ranking' : isPositionCard ? 'Criar Ranking do Cargo' : createdConcursoId ? 'Ranking Criado' : 'Criar Novo Ranking'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={e => e.preventDefault()}>
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <div className="flex justify-between items-center mb-6">
                  <TabsList>
                    <TabsTrigger value="general-info">Informações Gerais</TabsTrigger>
                    <TabsTrigger value="answer-key" disabled={!createdConcursoId && !editToken}>
                      Gabarito da Banca
                    </TabsTrigger>
                  </TabsList>
                  {createdConcursoId && (
                    <Button type="button" variant="outline" onClick={handleGoToResults}>
                      Ir para Resultados
                    </Button>
                  )}
                </div>
                <TabsContent value="general-info">
                  <GeneralTab form={form} jobTitles={jobTitles} isCustomTitle={isCustomTitle} isCustomBanca={isCustomBanca} handleJobTitleChange={handleJobTitleChange} handleCustomTitleChange={handleCustomTitleChange} handleBancaChange={handleBancaChange} handleOrgaoChange={handleOrgaoChange} handleNextTab={handleNextTab} onSaveRanking={handleSaveRanking} onGoToResults={handleGoToResults} isSubmitting={isSubmitting} selectedStates={selectedStates} setSelectedStates={setSelectedStates} createdConcursoId={createdConcursoId} />
                </TabsContent>
                <TabsContent value="answer-key">
                  {(createdConcursoId || editToken) && <AnswerKeyTab concursoId={createdConcursoId || ''} onGoToResults={handleGoToResults} />}
                </TabsContent>
              </Tabs>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
};
export default CriarRankingPage;