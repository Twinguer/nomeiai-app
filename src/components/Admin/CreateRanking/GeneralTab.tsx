
import React, { useEffect, useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { BasicInfoSection } from './BasicInfoSection';
import { ExamStructureSection } from './ExamStructureSection';
import { ReservationQuotasSection } from './ReservationQuotasSection';
import { MinimumScoreSection } from './MinimumScoreSection';
import { ExamBookletsSection } from './ExamBookletsSection';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { devLog, sanitizeForLog } from '@/utils/productionLogger';

interface GeneralTabProps {
  form: any;
  jobTitles: Array<{id: string, title: string}>;
  isCustomTitle: boolean;
  isCustomBanca: boolean;
  handleJobTitleChange: (value: string) => void;
  handleCustomTitleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleBancaChange: (value: string) => void;
  handleOrgaoChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleNextTab: () => void;
  onSaveRanking?: () => Promise<string | null>;
  onGoToResults?: () => void;
  isSubmitting?: boolean;
  selectedStates: string[];
  setSelectedStates: React.Dispatch<React.SetStateAction<string[]>>;
  createdConcursoId?: string;
}

export const GeneralTab: React.FC<GeneralTabProps> = ({
  form,
  jobTitles,
  isCustomTitle,
  isCustomBanca,
  handleJobTitleChange,
  handleCustomTitleChange,
  handleBancaChange,
  handleOrgaoChange,
  handleNextTab,
  onSaveRanking,
  onGoToResults,
  isSubmitting,
  selectedStates,
  setSelectedStates,
  createdConcursoId
}) => {
  const [booklets, setBooklets] = useState<Array<{id?: string, name: string, display_order: number}>>([]);
  const [isSavingAll, setIsSavingAll] = useState(false);
  const { toast } = useToast();
  const bookletsRef = useRef<Array<{id?: string, name: string, display_order: number}>>([]);
  const queryClient = useQueryClient();

  useEffect(() => {
    const formValues = form.getValues();
    if (formValues.localidades && Array.isArray(formValues.localidades) && formValues.localidades.length > 0) {
      setSelectedStates(formValues.localidades);
    }
  }, [form, setSelectedStates]);

  // Keep booklets in ref for access during save
  useEffect(() => {
    bookletsRef.current = booklets;
  }, [booklets]);

  const validateBeforeSave = () => {
    const currentValues = form.getValues();
    // Debug logs removed for security

    // Verificar se é card de cargo (campos vêm do parent)
    const isPositionCard = !!currentValues.parent_concurso_id || currentValues.ranking_type === 'position';

    // Validação de cadernos criados (não salvos, pois handleFillAnswerKey salva depois)
    // Debug logs removed for security
    
    // Verificar se há cadernos criados (não se já foram salvos)
    const currentBooklets = booklets.length > 0 ? booklets : bookletsRef.current;
    if (currentBooklets.length === 0) {
      // Debug logs removed for security
      toast({
        title: "Cadernos obrigatórios",
        description: "É necessário criar ao menos 1 caderno de prova antes de salvar o ranking.",
        variant: "destructive"
      });
      return false;
    }

    // Validações específicas para card de cargo
    if (isPositionCard) {
      // Para cargo, validar apenas campos específicos
      if (!currentValues.cargo) {
        toast({
          title: "Erro de validação",
          description: "Por favor, informe o nome do cargo.",
          variant: "destructive"
        });
        return false;
      }

      // Se for unificado, validar estado
      if (currentValues.is_unified && !currentValues.state_uf) {
        toast({
          title: "Erro de validação",
          description: "Por favor, selecione o estado/UF.",
          variant: "destructive"
        });
        return false;
      }

      // Campos de órgão, banca e título vêm do parent, não validar
      // Pular para validações de cotas e disciplinas
    } else {
      // Validações para card geral
      if (!currentValues.predefined_job_title) {
        toast({
          title: "Erro de validação",
          description: "Por favor, selecione um órgão.",
          variant: "destructive"
        });
        return false;
      }

      if (currentValues.predefined_job_title === "OUTRO" && !currentValues.custom_job_title) {
        toast({
          title: "Erro de validação",
          description: "Por favor, informe o órgão personalizado.",
          variant: "destructive"
        });
        return false;
      }

      if (selectedStates.length === 0) {
        toast({
          title: "Erro de validação",
          description: "Por favor, selecione pelo menos um estado.",
          variant: "destructive"
        });
        return false;
      }

      if (!currentValues.banca) {
        toast({
          title: "Erro de validação",
          description: "Por favor, selecione uma banca.",
          variant: "destructive"
        });
        return false;
      }

      if (currentValues.banca === "OUTRO" && !currentValues.custom_banca) {
        toast({
          title: "Erro de validação",
          description: "Por favor, informe a banca personalizada.",
          variant: "destructive"
        });
        return false;
      }
    }

    // Verificar se há cotas de reserva selecionadas
    const hasAnyQuota = 
      currentValues.has_ampla_concorrencia || 
      currentValues.has_ppp || 
      currentValues.has_pcd ||
      currentValues.has_hipossuficientes ||
      currentValues.has_indigenas ||
      currentValues.has_transsexuais;

    if (!hasAnyQuota) {
      toast({
        title: "Erro de validação",
        description: "Por favor, selecione pelo menos uma cota de reserva.",
        variant: "destructive"
      });
      return false;
    }
    
    // Verificar se há pelo menos uma disciplina habilitada na nova estrutura de blocos
    let hasEnabledDiscipline = false;
    
    if (Array.isArray(currentValues.disciplines)) {
      // Iterar pelos blocos
      for (const block of currentValues.disciplines) {
        // Verificar se o bloco tem disciplinas
        if (block.disciplines && Array.isArray(block.disciplines)) {
          // Verificar se há pelo menos uma disciplina habilitada no bloco
          for (const discipline of block.disciplines) {
            if (discipline.isEnabled === true) {
              hasEnabledDiscipline = true;
              break;
            }
          }
        }
        
        if (hasEnabledDiscipline) break;
      }
    }
    
    if (!hasEnabledDiscipline) {
      toast({
        title: "Erro de validação",
        description: "Por favor, selecione ao menos uma disciplina.",
        variant: "destructive"
      });
      return false;
    }

    return true;
  };

  const validateBooklets = (): boolean => {
    // Usar o estado booklets em vez de bookletsRef.current
    const currentBooklets = booklets.length > 0 ? booklets : bookletsRef.current;
    
    // Debug logs removed for security
    // Debug logs removed for security
    // Debug logs removed for security
    
    // Validar se há pelo menos 1 caderno
    if (currentBooklets.length === 0) {
      // Debug logs removed for security
      toast({
        title: "Cadernos obrigatórios",
        description: "É necessário criar ao menos 1 caderno de prova antes de preencher o gabarito",
        variant: "destructive"
      });
      return false;
    }

    const names = currentBooklets.map(b => b.name.trim()).filter(n => n);
    const uniqueNames = new Set(names);
    
    if (names.length !== currentBooklets.length) {
      toast({
        title: "Erro nos cadernos",
        description: "Todos os cadernos devem ter um nome preenchido",
        variant: "destructive"
      });
      return false;
    }
    
    if (names.length !== uniqueNames.size) {
      toast({
        title: "Erro nos cadernos",
        description: "Nomes dos cadernos devem ser únicos",
        variant: "destructive"
      });
      return false;
    }
    
    return true;
  };

  const processBooklets = (bookletsSnapshot: Array<{id?: string, name: string, display_order: number}>) => {
    return bookletsSnapshot.map((booklet, index) => ({
      id: booklet.id || crypto.randomUUID(),
      name: booklet.name,
      display_order: booklet.display_order || index + 1,
      is_active: true,
      total_questions: 0
    }));
  };

  const handleFillAnswerKey = async () => {
    if (!validateBeforeSave()) return;
    
    // Validar se há cadernos antes de prosseguir
    if (!validateBooklets()) return;

    // Criar snapshot dos cadernos ANTES de qualquer operação assíncrona
    const bookletsSnapshot = bookletsRef.current.map(b => ({ ...b }));
    const processedBooklets = processBooklets(bookletsSnapshot);

    setIsSavingAll(true);
    
    try {
      // Adicionar os cadernos processados ao formulário ANTES de salvar
      form.setValue('exam_booklets', processedBooklets, { shouldDirty: true });
      form.setValue('localidades', selectedStates, { shouldDirty: true });
      form.setValue('has_custom_knowledge', true);
      form.setValue('has_basic_knowledge', false);
      form.setValue('has_specific_knowledge_1', false);
      form.setValue('has_specific_knowledge_2', false);
      form.setValue('has_specific_knowledge_3', false);
      
      // Salvar ranking (com os cadernos incluídos no formValues)
      let concursoIdToUse: string | null = createdConcursoId || null;
      if (onSaveRanking) {
        const id = await onSaveRanking();
        concursoIdToUse = id || concursoIdToUse;
      }

      if (!concursoIdToUse) {
        return;
      }

      // Atualizar estado local dos cadernos
      setBooklets(processedBooklets);
      
      // Invalidar queries para forçar recarregamento
      queryClient.invalidateQueries({ queryKey: ['exam-booklets', concursoIdToUse] });
      queryClient.invalidateQueries({ queryKey: ['concurso', concursoIdToUse] });

      toast({
        title: "Sucesso!",
        description: "Ranking salvo. Você pode ir aos resultados (modo consenso) ou cadastrar o gabarito da banca quando disponível."
      });

      // Mudar para a aba de gabarito
      handleNextTab();
    } catch (error) {
      devLog.error("Erro ao salvar:", error);
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao salvar. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setIsSavingAll(false);
    }
  };

  const handleBookletsChange = (newBooklets: Array<{id?: string, name: string, display_order: number}>) => {
    setBooklets(newBooklets);
  };

  return (
    <div className="space-y-6">
      <BasicInfoSection 
        form={form}
        jobTitles={jobTitles}
        isCustomTitle={isCustomTitle}
        isCustomBanca={isCustomBanca}
        handleJobTitleChange={handleJobTitleChange}
        handleCustomTitleChange={handleCustomTitleChange}
        handleBancaChange={handleBancaChange}
        handleOrgaoChange={handleOrgaoChange}
        selectedStates={selectedStates}
        setSelectedStates={setSelectedStates}
      />

      <MinimumScoreSection form={form} />

      <ExamStructureSection form={form} />

      <ReservationQuotasSection form={form} />

      {/* Seção de cadernos sempre visível */}
      <ExamBookletsSection 
        concursoId={createdConcursoId}
        onBookletsChange={handleBookletsChange}
        onBookletsSaved={() => {}}
      />

      <div className="flex flex-col sm:flex-row justify-end gap-2">
        {createdConcursoId && onGoToResults && (
          <Button type="button" variant="outline" onClick={onGoToResults}>
            Ir para Resultados
          </Button>
        )}
        <Button
          type="button"
          onClick={handleFillAnswerKey}
          disabled={isSubmitting || isSavingAll}
          size="lg"
        >
          {isSavingAll ? 'Salvando...' : createdConcursoId ? 'Salvar alterações' : 'Salvar ranking'}
        </Button>
      </div>
    </div>
  );
};
