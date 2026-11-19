import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Save, CheckCircle, AlertTriangle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Concurso } from '@/types/concursos';
import { NullifyQuestionButton } from '../Admin/NullifyQuestionButton';
import { getSectionTypeForQuestion, updateSectionDisplayNames, getNumericValue } from '@/integrations/supabase/rankings/examStructure';
import { saveBookletAnswerKeyLegacy, getAnswerKeyForBooklet } from '@/services/answerKeyService';
import { devLog, sanitizeForLog } from '@/utils/productionLogger';
import {
  GabaritoStatusSelector,
  type GabaritoBancaStatus,
} from './CreateRanking/GabaritoStatusSelector';
interface AnswerKeyFormProps {
  concursoId: string;
  bookletId: string;
}
export const AnswerKeyForm: React.FC<AnswerKeyFormProps> = ({
  concursoId,
  bookletId
}) => {
  const [selectedSection, setSelectedSection] = useState<string>('basic');
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<{
    [key: number]: string;
  }>({});
  const [nullifiedQuestions, setNullifiedQuestions] = useState<Set<number>>(new Set());
  const [gabaritoStatus, setGabaritoStatus] = useState<GabaritoBancaStatus>('preliminary');
  const {
    toast
  } = useToast();
  const queryClient = useQueryClient();
  const {
    data: concurso,
    isLoading: isLoadingConcurso
  } = useQuery({
    queryKey: ['concurso-details', concursoId],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from('concursos').select('*').eq('id', concursoId).single();
      if (error) throw error;
      return data as unknown as Concurso;
    }
  });
  const {
    data: existingAnswers,
    isLoading: isLoadingAnswers,
    refetch: refetchAnswers
  } = useQuery({
    queryKey: ['official-answers-weights', concursoId, bookletId],
    queryFn: async () => {
      // Log removido por segurança
      const result = await getAnswerKeyForBooklet(concursoId, bookletId);
      if (!result.success) {
        devLog.error('Erro ao buscar gabarito:', result.error);
        throw new Error(result.error);
      }
      // Log removido por segurança
      return result.data || [];
    },
    enabled: !!concursoId && !!bookletId
  });
  useEffect(() => {
    if (existingAnswers && existingAnswers.length > 0) {
      const answersMap: {
        [key: number]: string;
      } = {};
      const nullifiedSet = new Set<number>();
      existingAnswers.forEach((answer: any) => {
        answersMap[answer.question_number] = answer.correct_answer;
        if (answer.is_nullified) {
          nullifiedSet.add(answer.question_number);
        }
      });
      setAnswers(answersMap);
      setNullifiedQuestions(nullifiedSet);
    }
  }, [existingAnswers]);

  useEffect(() => {
    if (concurso?.gabarito_status === 'final') {
      setGabaritoStatus('final');
    } else if (concurso?.gabarito_status === 'preliminary') {
      setGabaritoStatus('preliminary');
    }
  }, [concurso?.gabarito_status]);

  // Atualizar os nomes de exibição com conhecimentos customizados
  const sectionNames = concurso ? updateSectionDisplayNames(concurso) : {};

  // Função para obter todas as questões de todas as seções
  const getAllQuestionsFromAllSections = () => {
    if (!concurso) return [];
    const allQuestions: number[] = [];
    let currentQuestionNumber = 1;

    // Debug logs removed for security
    // Debug logs removed for security
    // Debug logs removed for security

    // Verificar se estamos lidando com a nova estrutura hierárquica (objeto com blocks)
    if (concurso.disciplines && typeof concurso.disciplines === 'object' && !Array.isArray(concurso.disciplines) && concurso.disciplines.blocks) {
      // Debug logs removed for security
      // Nova estrutura: {minimum_total_score, minimum_total_score_cotas, blocks: [...]}
      for (const block of concurso.disciplines.blocks) {
        if (block.disciplines && Array.isArray(block.disciplines)) {
          for (const discipline of block.disciplines) {
            if (discipline.isEnabled) {
              const questionCount = getNumericValue(discipline.questionCount);
              // Debug logs removed for security
              for (let i = 0; i < questionCount; i++) {
                allQuestions.push(currentQuestionNumber++);
              }
            }
          }
        }
      }
    } else if (concurso.disciplines && Array.isArray(concurso.disciplines) && concurso.disciplines.length > 0) {
      // Debug logs removed for security
      const isHierarchical = concurso.disciplines[0] && typeof concurso.disciplines[0] === 'object' && 'name' in concurso.disciplines[0] && 'disciplines' in concurso.disciplines[0];
      if (isHierarchical) {
        // Estrutura hierárquica antiga
        for (const block of concurso.disciplines as any[]) {
          if (block.disciplines && Array.isArray(block.disciplines)) {
            for (const discipline of block.disciplines) {
              if (discipline.isEnabled) {
                const questionCount = getNumericValue(discipline.questionCount);
                for (let i = 0; i < questionCount; i++) {
                  allQuestions.push(currentQuestionNumber++);
                }
              }
            }
          }
        }
      } else {
        // Estrutura plana antiga
        for (const discipline of concurso.disciplines) {
          if (discipline.isEnabled && discipline.questionCount) {
            const questionCount = getNumericValue(discipline.questionCount);
            for (let i = 0; i < questionCount; i++) {
              allQuestions.push(currentQuestionNumber++);
            }
          }
        }
      }
    } else {
      // Seções padrão
      if (concurso.has_basic_knowledge && concurso.basic_knowledge_questions) {
        for (let i = 0; i < concurso.basic_knowledge_questions; i++) {
          allQuestions.push(currentQuestionNumber++);
        }
      }
      if (concurso.has_specific_knowledge_1 && concurso.specific_knowledge_1_questions) {
        for (let i = 0; i < concurso.specific_knowledge_1_questions; i++) {
          allQuestions.push(currentQuestionNumber++);
        }
      }
      if (concurso.has_specific_knowledge_2 && concurso.specific_knowledge_2_questions) {
        for (let i = 0; i < concurso.specific_knowledge_2_questions; i++) {
          allQuestions.push(currentQuestionNumber++);
        }
      }
      if (concurso.has_specific_knowledge_3 && concurso.specific_knowledge_3_questions) {
        for (let i = 0; i < concurso.specific_knowledge_3_questions; i++) {
          allQuestions.push(currentQuestionNumber++);
        }
      }
    }
    
    // Debug logs removed for security
    // Debug logs removed for security
    
    return allQuestions;
  };

  // Função unificada para obter o número de questões por seção
  const getQuestionsCount = (section: string): number => {
    if (!concurso) return 0;
    
    // Debug logs removed for security
    // Debug logs removed for security
    
    // Verificar se estamos usando a nova estrutura hierárquica (objeto com blocks)
    if (concurso.disciplines && typeof concurso.disciplines === 'object' && !Array.isArray(concurso.disciplines) && concurso.disciplines.blocks) {
      // Debug logs removed for security
      // Debug logs removed for security
      
      // Nova estrutura: {minimum_total_score, minimum_total_score_cotas, blocks: [...]}
      for (const block of concurso.disciplines.blocks) {
        // Debug logs removed for security
        
        if (block.disciplines && Array.isArray(block.disciplines)) {
          for (const discipline of block.disciplines) {
            // Debug logs removed for security
            
            if (discipline.type === section && discipline.isEnabled) {
              const count = getNumericValue(discipline.questionCount);
              // Debug logs removed for security
              return count;
            }
          }
        }
      }
      // Debug logs removed for security
      return 0;
    }
    // Verificar se estamos usando a estrutura hierárquica antiga (array de blocos)
    else if (concurso.disciplines && Array.isArray(concurso.disciplines) && concurso.disciplines.length > 0) {
      const isHierarchical = concurso.disciplines[0] && typeof concurso.disciplines[0] === 'object' && 'name' in concurso.disciplines[0] && 'disciplines' in concurso.disciplines[0];
      if (isHierarchical) {
        // Estrutura hierárquica antiga
        for (const block of concurso.disciplines as any[]) {
          if (block.disciplines && Array.isArray(block.disciplines)) {
            for (const discipline of block.disciplines) {
              if (discipline.type === section && discipline.isEnabled) {
                return getNumericValue(discipline.questionCount);
              }
            }
          }
        }
      } else {
        // Estrutura plana antiga
        for (const discipline of concurso.disciplines) {
          if (discipline.type === section && discipline.isEnabled) {
            return getNumericValue(discipline.questionCount);
          }
        }
      }
      return 0;
    } else {
      // Estrutura tradicional
      if (section === 'basic' && concurso.has_basic_knowledge) {
        return concurso.basic_knowledge_questions || 0;
      } else if (section === 'specific1' && concurso.has_specific_knowledge_1) {
        return concurso.specific_knowledge_1_questions || 0;
      } else if (section === 'specific2' && concurso.has_specific_knowledge_2) {
        return concurso.specific_knowledge_2_questions || 0;
      } else if (section === 'specific3' && concurso.has_specific_knowledge_3) {
        return concurso.specific_knowledge_3_questions || 0;
      }
      return 0;
    }
  };
  const handleAnswerChange = (questionNumber: number, answer: string) => {
    setAnswers(prev => ({
      ...prev,
      [questionNumber]: answer
    }));
  };
  const handleNullifyQuestion = (questionNumber: number) => {
    setNullifiedQuestions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(questionNumber)) {
        newSet.delete(questionNumber);
      } else {
        newSet.add(questionNumber);
      }
      return newSet;
    });
  };
  const createAnswerMatrix = () => {
    const questions = getQuestionsRange();
    if (questions.length === 0) return [];
    const QUESTIONS_PER_ROW = 4;
    const rows = Math.ceil(questions.length / QUESTIONS_PER_ROW);
    const matrix = [];
    for (let row = 0; row < rows; row++) {
      const rowData = [];
      for (let col = 0; col < QUESTIONS_PER_ROW; col++) {
        const index = row * QUESTIONS_PER_ROW + col;
        if (index < questions.length) {
          rowData.push(questions[index]);
        } else {
          rowData.push(null);
        }
      }
      matrix.push(rowData);
    }
    return matrix;
  };
  const handleSaveCurrentBooklet = async () => {
    try {
      setIsSaving(true);
      setError(null);
      setSavedSuccess(false);

      // Verificar apenas as questões do caderno atual
      const allQuestions = getAllQuestionsFromAllSections();
      const unansweredQuestions = allQuestions.filter(q => !answers[q]);
      if (unansweredQuestions.length > 0) {
        setError(`Todas as questões do caderno ${bookletId} devem ser respondidas. Faltam as questões: ${unansweredQuestions.join(', ')}`);
        toast({
          title: "Erro ao salvar gabarito",
          description: "Todas as questões deste caderno devem ser respondidas antes de salvar.",
          variant: "destructive"
        });
        return;
      }

      // Preparar dados para salvar apenas este caderno
      const answerKeyData = allQuestions.map(qNum => {
        const sectionType = getSectionTypeForQuestion(concurso, qNum);
        // Log removido por segurança
        return {
          concurso_id: concursoId,
          booklet_id: bookletId,
          question_number: qNum,
          correct_answer: answers[qNum],
          weight: 1.0,
          section_type: sectionType,
          is_nullified: nullifiedQuestions.has(qNum)
        };
      });
      // Log removido por segurança

      // Usar o serviço para salvar o caderno
      const result = await saveBookletAnswerKeyLegacy(
        concursoId,
        bookletId,
        answerKeyData,
        gabaritoStatus
      );
      if (!result.success) {
        throw new Error(result.error);
      }
      // Log removido por segurança
      setSavedSuccess(true);

      // Atualizar dados
      refetchAnswers();
      
      toast({
        title: "Gabarito salvo com sucesso",
        description: `Gabarito ${gabaritoStatus === 'final' ? 'definitivo' : 'provisório'} salvo para o caderno ${bookletId}. As pontuações serão recalculadas automaticamente.`
      });

      // ℹ️ Recálculo automático está desativado (função SQL comentada)
      // Admin deve clicar em "Atualizar Classificação" na página de resultados
      // Debug logs removed for security
      
      // Invalidar cache imediatamente para mostrar gabarito atualizado
      setTimeout(() => {
        // Debug logs removed for security
        // Usar queryClient diretamente do hook em vez de importar dentro do setTimeout
        queryClient.invalidateQueries({ queryKey: ['rankings', concursoId] });
        queryClient.invalidateQueries({ queryKey: ['participant-count-v2', concursoId] });
        queryClient.invalidateQueries({ queryKey: ['user-participation-v2'] });
        queryClient.invalidateQueries({ queryKey: ['concurso-details', concursoId] });
        queryClient.invalidateQueries({ queryKey: ['concurso', concursoId] });
        queryClient.invalidateQueries({ queryKey: ['official-answers-weights', concursoId] });
        // Debug logs removed for security
      }, 500); // Aguardar 500ms apenas para garantir que o salvamento foi concluído

      setTimeout(() => {
        setSavedSuccess(false);
      }, 3000);
    } catch (error: any) {
      devLog.error('Error saving answer key:', error);
      setError(error.message || "Ocorreu um erro ao salvar o gabarito oficial.");
      toast({
        title: "Erro ao salvar gabarito",
        description: error.message || "Ocorreu um erro ao salvar o gabarito oficial. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };
  const getOptionsForQuestion = () => {
    if (!concurso) return ['A', 'B', 'C', 'D', 'E'];
    if (concurso.exam_type === 'Certo ou Errado') {
      return ['C', 'E'];
    }
    const count = concurso.alternatives_count || 5;
    return Array.from({
      length: count
    }, (_, i) => String.fromCharCode(65 + i));
  };
  const getObjectiveSectionList = () => {
    if (!concurso) return [];
    const sections = [];

    // Verificar se estamos usando a nova estrutura hierárquica (objeto com blocks)
    if (concurso.disciplines && typeof concurso.disciplines === 'object' && !Array.isArray(concurso.disciplines) && concurso.disciplines.blocks) {
      // Debug logs removed for security
      // Nova estrutura: {minimum_total_score, minimum_total_score_cotas, blocks: [...]}
      for (const block of concurso.disciplines.blocks) {
        if (block.disciplines && Array.isArray(block.disciplines)) {
          for (const discipline of block.disciplines) {
            if (discipline.isEnabled) {
              sections.push({
                key: discipline.type,
                label: `${block.blockName} - ${discipline.name}`
              });
            }
          }
        }
      }
    }
    // Verificar se estamos usando a estrutura hierárquica antiga (array de blocos)
    else if (concurso.disciplines && Array.isArray(concurso.disciplines) && concurso.disciplines.length > 0) {
      const isHierarchical = concurso.disciplines[0] && typeof concurso.disciplines[0] === 'object' && 'name' in concurso.disciplines[0] && 'disciplines' in concurso.disciplines[0];
      if (isHierarchical) {
        // Processar a estrutura hierárquica para criar as abas
        for (const block of concurso.disciplines as any[]) {
          if (block.disciplines && Array.isArray(block.disciplines)) {
            for (const discipline of block.disciplines) {
              if (discipline.isEnabled) {
                sections.push({
                  key: discipline.type,
                  label: `${block.name} - ${discipline.name}`
                });
              }
            }
          }
        }
      } else {
        // Processar estrutura plana para compatibilidade
        for (const discipline of concurso.disciplines) {
          if (discipline.isEnabled) {
            sections.push({
              key: discipline.type,
              label: discipline.name
            });
          }
        }
      }
    } else {
      // Estrutura tradicional
      if (concurso.has_basic_knowledge) {
        sections.push({
          key: 'basic',
          label: 'Conhecimentos Básicos'
        });
      }
      if (concurso.has_specific_knowledge_1) {
        sections.push({
          key: 'specific1',
          label: 'C. Específicos 1'
        });
      }
      if (concurso.has_specific_knowledge_2) {
        sections.push({
          key: 'specific2',
          label: 'C. Específicos 2'
        });
      }
      if (concurso.has_specific_knowledge_3) {
        sections.push({
          key: 'specific3',
          label: 'C. Específicos 3'
        });
      }
    }
    return sections;
  };

  // Ajustar a função getQuestionsRange para trabalhar com a estrutura hierárquica
  const getQuestionsRange = () => {
    if (!concurso) return [];

    // Verificar se estamos usando a nova estrutura hierárquica (objeto com blocks)
    if (concurso.disciplines && typeof concurso.disciplines === 'object' && !Array.isArray(concurso.disciplines) && concurso.disciplines.blocks) {
      // Debug logs removed for security
      let startQuestion = 1;
      
      // Nova estrutura: {minimum_total_score, minimum_total_score_cotas, blocks: [...]}
      for (const block of concurso.disciplines.blocks) {
        if (block.disciplines && Array.isArray(block.disciplines)) {
          for (const discipline of block.disciplines) {
            if (discipline.isEnabled) {
              const questionCount = getNumericValue(discipline.questionCount);

              // Se encontramos a disciplina selecionada, retornar seu intervalo
              if (discipline.type === selectedSection) {
                // Debug logs removed for security
                return Array.from({
                  length: questionCount
                }, (_, i) => startQuestion + i);
              }

              // Atualizar o contador para a próxima disciplina
              startQuestion += questionCount;
            }
          }
        }
      }
      return []; // Retornar vazio se não encontrou a disciplina selecionada
    }
    // Verificar se estamos usando a estrutura hierárquica antiga (array de blocos)
    else if (concurso.disciplines && Array.isArray(concurso.disciplines) && concurso.disciplines.length > 0) {
      const isHierarchical = concurso.disciplines[0] && typeof concurso.disciplines[0] === 'object' && 'name' in concurso.disciplines[0] && 'disciplines' in concurso.disciplines[0];
      let startQuestion = 1;
      if (isHierarchical) {
        // Estrutura hierárquica antiga
        for (const block of concurso.disciplines as any[]) {
          if (block.disciplines && Array.isArray(block.disciplines)) {
            for (const discipline of block.disciplines) {
              if (discipline.isEnabled) {
                const questionCount = getNumericValue(discipline.questionCount);

                // Se encontramos a disciplina selecionada, retornar seu intervalo
                if (discipline.type === selectedSection) {
                  return Array.from({
                    length: questionCount
                  }, (_, i) => startQuestion + i);
                }

                // Atualizar o contador para a próxima disciplina
                startQuestion += questionCount;
              }
            }
          }
        }
      } else {
        // Estrutura plana antiga
        for (const discipline of concurso.disciplines) {
          if (discipline.isEnabled) {
            const questionCount = getNumericValue(discipline.questionCount);
            if (discipline.type === selectedSection) {
              return Array.from({
                length: questionCount
              }, (_, i) => startQuestion + i);
            }
            startQuestion += questionCount;
          }
        }
      }
      return []; // Retornar vazio se não encontrou a disciplina selecionada
    } else {
      // Para a estrutura tradicional
      if (selectedSection === 'basic') {
        return Array.from({
          length: getQuestionsCount('basic')
        }, (_, i) => i + 1);
      } else if (selectedSection === 'specific1') {
        let startNumber = 1;
        if (concurso.has_basic_knowledge) {
          startNumber += concurso.basic_knowledge_questions || 0;
        }
        return Array.from({
          length: getQuestionsCount('specific1')
        }, (_, i) => startNumber + i);
      } else if (selectedSection === 'specific2') {
        let startNumber = 1;
        if (concurso.has_basic_knowledge) {
          startNumber += concurso.basic_knowledge_questions || 0;
        }
        if (concurso.has_specific_knowledge_1) {
          startNumber += concurso.specific_knowledge_1_questions || 0;
        }
        return Array.from({
          length: getQuestionsCount('specific2')
        }, (_, i) => startNumber + i);
      } else if (selectedSection === 'specific3') {
        let startNumber = 1;
        if (concurso.has_basic_knowledge) {
          startNumber += concurso.basic_knowledge_questions || 0;
        }
        if (concurso.has_specific_knowledge_1) {
          startNumber += concurso.specific_knowledge_1_questions || 0;
        }
        if (concurso.has_specific_knowledge_2) {
          startNumber += concurso.specific_knowledge_2_questions || 0;
        }
        return Array.from({
          length: getQuestionsCount('specific3')
        }, (_, i) => startNumber + i);
      }
      return [];
    }
  };

  // Inicializar a primeira seção disponível
  useEffect(() => {
    if (concurso) {
      const sections = getObjectiveSectionList();
      if (sections.length > 0) {
        setSelectedSection(sections[0].key);
      }
    }
  }, [concurso]);

  // Avaliação de carregamento
  if (isLoadingConcurso || isLoadingAnswers) {
    return <Card>
        <CardContent className="flex flex-col items-center justify-center p-12 space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-center text-muted-foreground">Carregando informações do gabarito...</p>
        </CardContent>
      </Card>;
  }
  if (!concurso) {
    return <Card>
        <CardContent className="p-6">
          <div className="flex items-center text-destructive space-x-2">
            <AlertTriangle className="h-5 w-5" />
            <p>Não foi possível carregar as informações do concurso.</p>
          </div>
        </CardContent>
      </Card>;
  }
  const totalQuestions = getAllQuestionsFromAllSections().length;
  const answeredQuestions = Object.keys(answers).length;
  const percentageComplete = totalQuestions > 0 ? Math.floor(answeredQuestions / totalQuestions * 100) : 0;
  const objectiveSections = getObjectiveSectionList();
  return <Card>
      <CardContent className="space-y-6">
        {/* Error message */}
        {error && <div className="bg-destructive/15 p-3 rounded-md flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-4 w-4" />
            <p>{error}</p>
          </div>}
        
        {/* Success message */}
        {savedSuccess && <div className="bg-green-100 p-3 rounded-md flex items-center gap-2 text-green-800">
            <CheckCircle className="h-4 w-4" />
            <p>Gabarito do caderno {bookletId} salvo com sucesso!</p>
          </div>}
        
        {/* Progress indicator */}
        <div className="bg-primary/10 border border-primary/20 rounded-md p-4 mx-0 my-[20px]">
          <div className="flex flex-col">
            <h4 className="font-medium text-primary">Progresso do preenchimento</h4>
            <p className="text-sm text-primary mt-1">
              {answeredQuestions} de {totalQuestions} questões respondidas ({percentageComplete}%)
            </p>
            <div className="w-full bg-muted rounded-full h-2.5 mt-2">
              <div className="bg-primary h-2.5 rounded-full" style={{
              width: `${percentageComplete}%`
            }}></div>
            </div>
            <p className="text-xs text-primary mt-2">
              Todas as questões deste caderno precisam ser respondidas antes de salvar.
            </p>
          </div>
        </div>
        
        {/* Tabs for sections */}
        {objectiveSections.length > 0 && <div className="border rounded-md overflow-hidden shadow-sm">
            <Tabs value={selectedSection} onValueChange={value => setSelectedSection(value)} className="w-full">
              <TabsList className="flex flex-wrap w-full gap-1 p-1">
                {objectiveSections.map(section => {
                  // Calcular o número máximo de abas por linha (máximo 6)
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
              </TabsList>
              
              {objectiveSections.map(section => <TabsContent key={section.key} value={section.key}>
                  <div className="p-4 bg-muted/30">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                      {getQuestionsRange().map((questionNumber) => (
                        <div key={`q-${questionNumber}`} className="border border-border rounded-md p-3 bg-card">
                          <div className="mb-2 font-medium text-foreground">Questão {questionNumber}</div>
                          <div className="flex flex-nowrap gap-1 justify-center">
                            {getOptionsForQuestion().map(option => <button key={option} className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${answers[questionNumber] === option ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`} onClick={() => handleAnswerChange(questionNumber, option)} disabled={nullifiedQuestions.has(questionNumber)} type="button">
                                {option}
                              </button>)}
                          </div>
                          <NullifyQuestionButton questionNumber={questionNumber} isNullified={nullifiedQuestions.has(questionNumber)} onNullify={handleNullifyQuestion} />
                        </div>
                      ))}
                    </div>
                  </div>
                </TabsContent>)}
            </Tabs>
          </div>}
        
        {/* Status do gabarito da banca (transparência) */}
        <GabaritoStatusSelector
          value={gabaritoStatus}
          onChange={setGabaritoStatus}
          disabled={isSaving}
        />

        {/* Action button - Save only current booklet */}
        <div className="flex justify-center mt-4">
          <Button onClick={handleSaveCurrentBooklet} className="bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isSaving}>
            {isSaving ? <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </> : <>
                <Save className="mr-2 h-4 w-4" />
                Salvar Gabarito do Caderno
              </>}
          </Button>
        </div>
      </CardContent>
    </Card>;
};