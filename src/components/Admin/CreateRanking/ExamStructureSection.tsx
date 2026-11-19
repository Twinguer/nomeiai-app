import React, { useState, useEffect } from 'react';
import { FormField, FormItem, FormLabel, FormControl, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Plus, Trash2, Settings } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
interface ExamStructureSectionProps {
  form: any;
}
export const ExamStructureSectionComponent: React.FC<ExamStructureSectionProps> = ({
  form
}) => {
  // Set custom knowledge to true by default
  const [isCustomKnowledge, setIsCustomKnowledge] = useState<boolean>(true);
  const [hasMinimumScore, setHasMinimumScore] = useState<boolean>(true);

  // Determine if we should show penalty options
  const showPenaltyOptions = form.watch('exam_type') === 'Certo ou Errado';
  
  // Forçar peso = 1 para todas as disciplinas quando tipo for "Certo ou Errado"
  useEffect(() => {
    if (form.watch('exam_type') === 'Certo ou Errado') {
      const disciplines = form.watch('disciplines') || [];
      const updatedDisciplines = disciplines.map((block: any) => {
        if (block.disciplines && Array.isArray(block.disciplines)) {
          return {
            ...block,
            disciplines: block.disciplines.map((discipline: any) => ({
              ...discipline,
              weight: 1
            }))
          };
        } else {
          return {
            ...block,
            weight: 1
          };
        }
      });
      form.setValue('disciplines', updatedDisciplines);
    }
  }, [form.watch('exam_type')]);

  useEffect(() => {
    // Set default values if they don't exist
    // Always use custom knowledge
    form.setValue('has_custom_knowledge', true);

    // Check if we have any disciplines and add default if not
    const disciplines = form.watch('disciplines') || [];
    if (disciplines.length === 0) {
      // Apenas inicializar com array vazio - não criar blocos automaticamente
      // O usuário deve adicionar blocos e disciplinas manualmente
      form.setValue('disciplines', []);
    } else {
      // Garantir que todos os blocos têm minimum_score e minimum_score_cotas
      const updatedDisciplines = disciplines.map(block => {
        const updatedBlock = { ...block };
        if (updatedBlock.minimum_score === undefined) {
          updatedBlock.minimum_score = 0;
        }
        if (updatedBlock.minimum_score_cotas === undefined) {
          updatedBlock.minimum_score_cotas = 0;
        }
        return updatedBlock;
      });

      // Garantir que todas as disciplinas têm minimum_score e minimum_score_cotas
      const fullyUpdatedDisciplines = updatedDisciplines.map(block => {
        if (block.disciplines && Array.isArray(block.disciplines)) {
          return {
            ...block,
            disciplines: block.disciplines.map(discipline => {
              const updatedDiscipline = { ...discipline };
              if (updatedDiscipline.minimum_score === undefined) {
                updatedDiscipline.minimum_score = 0;
              }
              if (updatedDiscipline.minimum_score_cotas === undefined) {
                updatedDiscipline.minimum_score_cotas = 0;
              }
              if (updatedDiscipline.questionCount === undefined) {
                updatedDiscipline.questionCount = 10; // Valor padrão 10 em vez de 0
                // Debug logs removed for security
              }
              if (updatedDiscipline.weight === undefined) {
                updatedDiscipline.weight = 1;
              }
              return updatedDiscipline;
            })
          };
        }
        return block;
      });
      form.setValue('disciplines', fullyUpdatedDisciplines);
    }
  }, [form]);

  // Helper function for questions count inputs
  const renderQuestionsInput = (name: string) => <FormField control={form.control} name={name} render={({
    field
  }) => <FormItem>
          <FormLabel>Nº de Questões</FormLabel>
          <FormControl>
            <Input 
              type="number" 
              {...field} 
              min="0" 
              max="999"
              maxLength={3}
              onChange={e => {
                const value = e.target.value;
                if (value.length <= 3 && !isNaN(Number(value)) && Number(value) <= 999) {
                  field.onChange(Number(value));
                }
              }} 
            />
          </FormControl>
        </FormItem>} />;

  // Adicionar um novo bloco
  const handleAddBlock = () => {
    const currentBlocks = form.watch('disciplines') || [];
    const newBlock = {
      id: uuidv4(),
      name: '',
      minimum_score: 0,
      minimum_score_cotas: 0,
          disciplines: [{
            id: uuidv4(),
            name: '',
            type: `custom_${uuidv4().slice(0, 8)}`,
            isEnabled: true,
            questionCount: 10,
            weight: 1,
            minimum_score: 0,
            minimum_score_cotas: 0
          }]
    };
    form.setValue('disciplines', [...currentBlocks, newBlock]);
  };

  // Remover um bloco
  const handleRemoveBlock = (blockId: string) => {
    const currentBlocks = form.watch('disciplines') || [];
    const updatedBlocks = currentBlocks.filter(block => block.id !== blockId);
    form.setValue('disciplines', updatedBlocks);
  };

  // Atualizar nome de um bloco (máx 20 caracteres)
  const handleBlockNameChange = (blockId: string, name: string) => {
    const truncatedName = name.slice(0, 20);
    const currentBlocks = form.watch('disciplines') || [];
    const updatedBlocks = currentBlocks.map(block => block.id === blockId ? {
      ...block,
      name: truncatedName
    } : block);
    form.setValue('disciplines', updatedBlocks);
  };

  // Atualizar nota mínima de um bloco
  const handleBlockMinimumScoreChange = (blockId: string, minimumScore: number) => {
    const currentBlocks = form.watch('disciplines') || [];
    const updatedBlocks = currentBlocks.map(block => block.id === blockId ? {
      ...block,
      minimum_score: minimumScore
    } : block);
    form.setValue('disciplines', updatedBlocks);
  };

  // Atualizar nota mínima de cotas de um bloco
  const handleBlockMinimumScoreCotasChange = (blockId: string, minimumScoreCotas: number) => {
    const currentBlocks = form.watch('disciplines') || [];
    const updatedBlocks = currentBlocks.map(block => block.id === blockId ? {
      ...block,
      minimum_score_cotas: minimumScoreCotas
    } : block);
    form.setValue('disciplines', updatedBlocks);
  };

  // Adicionar disciplina a um bloco
  const handleAddDiscipline = (blockId: string) => {
    const currentBlocks = form.watch('disciplines') || [];
    const updatedBlocks = currentBlocks.map(block => {
      if (block.id === blockId) {
        return {
          ...block,
          disciplines: [...(block.disciplines || []), {
            id: uuidv4(),
            name: '',
            type: `custom_${uuidv4().slice(0, 8)}`,
            isEnabled: true,
            questionCount: 10,
            weight: 1,
            minimum_score: 0,
            minimum_score_cotas: 0
          }]
        };
      }
      return block;
    });
    form.setValue('disciplines', updatedBlocks);
  };

  // Remover disciplina de um bloco
  const handleRemoveDiscipline = (blockId: string, disciplineId: string) => {
    const currentBlocks = form.watch('disciplines') || [];
    const updatedBlocks = currentBlocks.map(block => {
      if (block.id === blockId) {
        return {
          ...block,
          disciplines: (block.disciplines || []).filter(discipline => discipline.id !== disciplineId)
        };
      }
      return block;
    });
    form.setValue('disciplines', updatedBlocks);
  };

  // Atualizar campo de disciplina
  const handleDisciplineChange = (blockId: string, disciplineId: string, field: string, value: any) => {
    // Debug logs removed for security
    const processedValue = field === 'name' ? value.slice(0, 5) : value;
    const currentBlocks = form.watch('disciplines') || [];
    const updatedBlocks = currentBlocks.map(block => {
      if (block.id === blockId) {
        return {
          ...block,
          disciplines: (block.disciplines || []).map(discipline => {
            if (discipline.id === disciplineId) {
              const updatedDiscipline = {
                ...discipline,
                [field]: processedValue
              };
              // Debug logs removed for security
              return updatedDiscipline;
            }
            return discipline;
          })
        };
      }
      return block;
    });
    // Debug logs removed for security
    form.setValue('disciplines', updatedBlocks);
  };

  // Modified handler for toggle between knowledge types
  const handleKnowledgeTypeToggle = (value: boolean) => {
    setIsCustomKnowledge(value);
    form.setValue('has_custom_knowledge', value);
    if (value) {
      // Switching to custom mode - disable all standard knowledge sections
      form.setValue('has_basic_knowledge', false);
      form.setValue('has_specific_knowledge_1', false);
      form.setValue('has_specific_knowledge_2', false);
      form.setValue('has_specific_knowledge_3', false);
    } else {
      // Switching to standard mode - enable at least basic knowledge
      form.setValue('has_basic_knowledge', true);
      form.setValue('basic_knowledge_questions', 10);
      form.setValue('basic_knowledge_weight', 1);
    }
  };
  return <Card>
      <CardContent className="pt-6">
        <div className="grid grid-cols-1 gap-4 mb-4">
          <div>
            <h3 className="text-lg font-semibold">Estrutura da Prova</h3>
          </div>
          <div className="flex flex-col gap-4">
            {/* Tipo de Prova */}
            <FormField control={form.control} name="exam_type" render={({
            field
          }) => <FormItem>
                  <FormLabel>Tipo de Prova <span className="text-red-500">*</span></FormLabel>
                  <Select value={field.value || 'Alternativas'} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Alternativas">Múltipla Escolha</SelectItem>
                      <SelectItem value="Certo ou Errado">Certo ou Errado</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>} />
            
            {/* Quantidade de Alternativas - apenas para multipla escolha */}
            {form.watch('exam_type') !== 'Certo ou Errado' && <FormField control={form.control} name="alternatives_count" render={({
            field
          }) => <FormItem>
                    <FormLabel>Quantidade de Alternativas</FormLabel>
                    <Select defaultValue={String(field.value || 5)} onValueChange={value => field.onChange(Number(value))}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="4">4 (A-D)</SelectItem>
                        <SelectItem value="5">5 (A-E)</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>} />}
            
            {/* Penalidade para Erro - Apenas para provas Certo ou Errado */}
            {showPenaltyOptions && <FormField control={form.control} name="wrong_answer_penalty" render={({
            field
          }) => <FormItem>
                    <FormLabel>Penalidade para Erro</FormLabel>
                    <Select defaultValue={String(field.value || 0)} onValueChange={value => field.onChange(Number(value))}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="0">Sem penalidade</SelectItem>
                        <SelectItem value="0.5">0,5 pontos</SelectItem>
                        <SelectItem value="1">1 ponto</SelectItem>
                        <SelectItem value="1.5">1,5 pontos</SelectItem>
                        <SelectItem value="2">2 pontos</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Penalidade aplicada para cada resposta errada
                    </FormDescription>
                  </FormItem>} />}
          </div>
        </div>

        {/* Blocos de Disciplinas */}
        <div className="mb-6 border-t pt-4">
          <div className="flex justify-between items-center mb-4">
            <h4 className="font-medium">Blocos de Disciplinas</h4>
            <Button variant="outline" size="sm" onClick={handleAddBlock}>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Bloco
            </Button>
          </div>
          
          {/* Renderização dos blocos */}
          {form.watch('disciplines')?.map((block, blockIndex) => <div key={block.id} className="border border-border p-4 rounded-md mb-4">
              <div className="flex justify-between items-center mb-4">
                <div className="flex-grow">
                  <label className="text-sm font-medium text-foreground mb-1 block">
                    Nome do Bloco <span className="text-red-500">*</span>
                  </label>
                  <input className="font-medium text-base bg-transparent border-b border-border focus:border-primary outline-none w-[90%]" value={block.name?.slice(0, 20) || ''} onChange={e => handleBlockNameChange(block.id, e.target.value)} placeholder="Digite o nome do bloco" maxLength={20} />
                </div>
                <div className="flex items-center space-x-2">
                  <Button variant="ghost" size="sm" onClick={() => handleRemoveBlock(block.id)} className="text-red-500 hover:text-red-700">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              {/* Nota mínima do bloco */}
              <div className="mb-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <FormLabel>Nota mínima</FormLabel>
                    <Input 
                      type="number" 
                      step="0.01" 
                      min="0" 
                      max="999"
                      maxLength={5}
                      value={block.minimum_score || 0} 
                      onChange={e => {
                        const value = e.target.value;
                        // Limitar a 3 dígitos no total (ex: 999, 99.9, 9.99)
                        const digitsOnly = value.replace(/[^\d]/g, '');
                        if (digitsOnly.length <= 3 && !isNaN(parseFloat(value)) && parseFloat(value) >= 0 && parseFloat(value) <= 999) {
                          handleBlockMinimumScoreChange(block.id, parseFloat(value) || 0);
                        } else if (value === '' || value === '.') {
                          handleBlockMinimumScoreChange(block.id, 0);
                        }
                      }} 
                      className="w-full" 
                    />
                  </div>
                  <div>
                    <FormLabel>Nota mínima cotas</FormLabel>
                    <Input 
                      type="number" 
                      step="0.01" 
                      min="0" 
                      max="999"
                      maxLength={5}
                      value={block.minimum_score_cotas || 0} 
                      onChange={e => {
                        const value = e.target.value;
                        // Limitar a 3 dígitos no total (ex: 999, 99.9, 9.99)
                        const digitsOnly = value.replace(/[^\d]/g, '');
                        if (digitsOnly.length <= 3 && !isNaN(parseFloat(value)) && parseFloat(value) >= 0 && parseFloat(value) <= 999) {
                          handleBlockMinimumScoreCotasChange(block.id, parseFloat(value) || 0);
                        } else if (value === '' || value === '.') {
                          handleBlockMinimumScoreCotasChange(block.id, 0);
                        }
                      }} 
                      className="w-full" 
                    />
                  </div>
                </div>
              </div>
              
              {/* Disciplinas do bloco */}
              <div className="space-y-4 pl-4 border-l-2 border-border">
                {block.disciplines?.map((discipline, disciplineIndex) => <div key={discipline.id} className="border border-border p-4 rounded-md">
                    <div className="flex justify-between items-center mb-4">
                      <div className="flex-grow">
                        <label className="text-sm font-medium text-foreground mb-1 block">
                          Sigla da Disciplina <span className="text-red-500">*</span>
                        </label>
                        <input className="font-medium bg-transparent border-b border-border focus:border-primary outline-none w-[70%]" value={discipline.name?.slice(0, 5) || ''} onChange={e => handleDisciplineChange(block.id, discipline.id, 'name', e.target.value.slice(0, 5))} placeholder="Digite a sigla" maxLength={5} />
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => handleRemoveDiscipline(block.id, discipline.id)} className="text-red-500 hover:text-red-700">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <FormLabel>Nº de Questões</FormLabel>
                        <Input 
                          type="number" 
                          value={discipline.questionCount || 0} 
                          min="0" 
                          max="999"
                          maxLength={3}
                          onChange={e => {
                            const value = e.target.value;
                            // Debug logs removed for security
                            if (value.length <= 3 && !isNaN(Number(value)) && Number(value) <= 999) {
                              const numValue = Number(value);
                              // Debug logs removed for security
                              handleDisciplineChange(block.id, discipline.id, 'questionCount', numValue);
                            } else if (value === '') {
                              // Permitir campo vazio temporariamente
                              // Debug logs removed for security
                              handleDisciplineChange(block.id, discipline.id, 'questionCount', 0);
                            }
                          }}
                          onBlur={e => {
                            const value = e.target.value;
                            if (value === '' || Number(value) === 0) {
                              // Debug logs removed for security
                              handleDisciplineChange(block.id, discipline.id, 'questionCount', 10);
                            }
                          }}
                        />
                      </div>
                      <div>
                        <FormLabel>Peso</FormLabel>
                        {form.watch('exam_type') === 'Certo ou Errado' ? (
                          <div className="flex items-center space-x-2">
                            <Input 
                              type="number" 
                              value="1" 
                              disabled 
                              className="w-24 text-sm bg-muted"
                            />
                            <span className="text-xs text-muted-foreground">
                              Fixo em 1 para Certo ou Errado
                            </span>
                          </div>
                        ) : (
                          <Select value={String(discipline.weight || 1)} onValueChange={value => handleDisciplineChange(block.id, discipline.id, 'weight', Number(value))}>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o peso" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1">1</SelectItem>
                              <SelectItem value="2">2</SelectItem>
                              <SelectItem value="3">3</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                      <div>
                        <FormLabel>Nota mínima</FormLabel>
                        <Input 
                          type="number" 
                          step="0.01" 
                          min="0" 
                          max="999"
                          maxLength={5}
                          value={discipline.minimum_score || 0} 
                          onChange={e => {
                            const value = e.target.value;
                            // Limitar a 3 dígitos no total (ex: 999, 99.9, 9.99)
                            const digitsOnly = value.replace(/[^\d]/g, '');
                            if (digitsOnly.length <= 3 && !isNaN(parseFloat(value)) && parseFloat(value) >= 0 && parseFloat(value) <= 999) {
                              handleDisciplineChange(block.id, discipline.id, 'minimum_score', parseFloat(value) || 0);
                            } else if (value === '' || value === '.') {
                              handleDisciplineChange(block.id, discipline.id, 'minimum_score', 0);
                            }
                          }} 
                        />
                      </div>
                      <div>
                        <FormLabel>Nota mínima cotas</FormLabel>
                        <Input 
                          type="number" 
                          step="0.01" 
                          min="0" 
                          max="999"
                          maxLength={5}
                          value={discipline.minimum_score_cotas || 0} 
                          onChange={e => {
                            const value = e.target.value;
                            // Limitar a 3 dígitos no total (ex: 999, 99.9, 9.99)
                            const digitsOnly = value.replace(/[^\d]/g, '');
                            if (digitsOnly.length <= 3 && !isNaN(parseFloat(value)) && parseFloat(value) >= 0 && parseFloat(value) <= 999) {
                              handleDisciplineChange(block.id, discipline.id, 'minimum_score_cotas', parseFloat(value) || 0);
                            } else if (value === '' || value === '.') {
                              handleDisciplineChange(block.id, discipline.id, 'minimum_score_cotas', 0);
                            }
                          }} 
                        />
                      </div>
                    </div>
                  </div>)}
                
                {/* Botão para adicionar disciplina ao bloco */}
                <Button variant="outline" size="sm" onClick={() => handleAddDiscipline(block.id)} className="mt-2">
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Disciplina
                </Button>
              </div>
            </div>)}
          
          {/* Mensagem se não houver blocos */}
          {(!form.watch('disciplines') || form.watch('disciplines').length === 0) && <div className="text-center p-8 border border-dashed border-border rounded-md text-muted-foreground">
              Nenhum bloco adicionado. Clique em "Adicionar Bloco" para criar blocos de disciplinas.
            </div>}
        </div>
        
        {/* Dissertativa e Estudos de Caso - Mantém igual ao original */}
        <div className="mb-4 border-t pt-4">
          <div className="flex justify-between items-center mb-4">
            <h4 className="font-medium">Discursivas/Est. Caso</h4>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {!form.watch('has_discursive') && (
                  <DropdownMenuItem onClick={() => {
                    // Debug logs removed for security
                    form.setValue('has_discursive', true);
                    form.setValue('discursive_minimum_score', 0);
                  }}>
                    Dissertativa
                  </DropdownMenuItem>
                )}
                {!form.watch('has_case_study_1') && (
                  <DropdownMenuItem onClick={() => form.setValue('has_case_study_1', true)}>
                    Estudo de Caso
                  </DropdownMenuItem>
                )}
                {!form.watch('has_case_study_2') && (
                  <DropdownMenuItem onClick={() => form.setValue('has_case_study_2', true)}>
                    Estudo de Caso 2
                  </DropdownMenuItem>
                )}
                {!form.watch('has_case_study_3') && (
                  <DropdownMenuItem onClick={() => form.setValue('has_case_study_3', true)}>
                    Estudo de Caso 3
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => form.setValue('has_other_subjective', true)}>
                  Outro
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          
          {/* Dissertativa */}
          {form.watch('has_discursive') && <div className="border p-4 rounded-md mb-4">
              <div className="flex justify-between items-center mb-4">
                <h5 className="font-medium">Dissertativa</h5>
                <Button variant="ghost" size="sm" onClick={() => form.setValue('has_discursive', false)} className="text-red-500 hover:text-red-700">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <FormLabel>Nota Mínima</FormLabel>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="999"
                    maxLength={5}
                    placeholder="Ex: 6.0"
                    value={form.watch('discursive_minimum_score') || ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      // Limitar a 3 dígitos no total (ex: 999, 99.9, 9.99)
                      const digitsOnly = value.replace(/[^\d]/g, '');
                      if (digitsOnly.length <= 3 && !isNaN(parseFloat(value)) && parseFloat(value) >= 0 && parseFloat(value) <= 999) {
                        form.setValue('discursive_minimum_score', parseFloat(value) || 0);
                      } else if (value === '' || value === '.') {
                        form.setValue('discursive_minimum_score', 0);
                      }
                    }}
                  />
                </div>
                <div>
                  <FormLabel>Nota Mínima Cotas</FormLabel>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="999"
                    maxLength={5}
                    placeholder="Ex: 5.0"
                    value={form.watch('discursive_minimum_score_cotas') || ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      // Limitar a 3 dígitos no total (ex: 999, 99.9, 9.99)
                      const digitsOnly = value.replace(/[^\d]/g, '');
                      if (digitsOnly.length <= 3 && !isNaN(parseFloat(value)) && parseFloat(value) >= 0 && parseFloat(value) <= 999) {
                        form.setValue('discursive_minimum_score_cotas', parseFloat(value) || 0);
                      } else if (value === '' || value === '.') {
                        form.setValue('discursive_minimum_score_cotas', 0);
                      }
                    }}
                  />
                </div>
              </div>
            </div>}
          
          {/* Estudo de Caso 1 */}
          {form.watch('has_case_study_1') && <div className="border p-4 rounded-md mb-4">
              <div className="flex justify-between items-center mb-4">
                <h5 className="font-medium">Estudo de Caso</h5>
                <Button variant="ghost" size="sm" onClick={() => form.setValue('has_case_study_1', false)} className="text-red-500 hover:text-red-700">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <FormLabel>Nota Mínima</FormLabel>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="999"
                    maxLength={5}
                    placeholder="Ex: 6.0"
                    value={form.watch('case_study_1_minimum_score') || ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      // Limitar a 3 dígitos no total (ex: 999, 99.9, 9.99)
                      const digitsOnly = value.replace(/[^\d]/g, '');
                      if (digitsOnly.length <= 3 && !isNaN(parseFloat(value)) && parseFloat(value) >= 0 && parseFloat(value) <= 999) {
                        form.setValue('case_study_1_minimum_score', parseFloat(value) || 0);
                      } else if (value === '' || value === '.') {
                        form.setValue('case_study_1_minimum_score', 0);
                      }
                    }}
                  />
                </div>
                <div>
                  <FormLabel>Nota Mínima Cotas</FormLabel>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="999"
                    maxLength={5}
                    placeholder="Ex: 5.0"
                    value={form.watch('case_study_1_minimum_score_cotas') || ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      // Limitar a 3 dígitos no total (ex: 999, 99.9, 9.99)
                      const digitsOnly = value.replace(/[^\d]/g, '');
                      if (digitsOnly.length <= 3 && !isNaN(parseFloat(value)) && parseFloat(value) >= 0 && parseFloat(value) <= 999) {
                        form.setValue('case_study_1_minimum_score_cotas', parseFloat(value) || 0);
                      } else if (value === '' || value === '.') {
                        form.setValue('case_study_1_minimum_score_cotas', 0);
                      }
                    }}
                  />
                </div>
              </div>
            </div>}
          
          {/* Estudo de Caso 2 */}
          {form.watch('has_case_study_2') && <div className="border p-4 rounded-md mb-4">
              <div className="flex justify-between items-center mb-4">
                <h5 className="font-medium">Estudo de Caso 2</h5>
                <Button variant="ghost" size="sm" onClick={() => form.setValue('has_case_study_2', false)} className="text-red-500 hover:text-red-700">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <FormLabel>Nota Mínima</FormLabel>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="999"
                    maxLength={5}
                    placeholder="Ex: 6.0"
                    value={form.watch('case_study_2_minimum_score') || ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      // Limitar a 3 dígitos no total (ex: 999, 99.9, 9.99)
                      const digitsOnly = value.replace(/[^\d]/g, '');
                      if (digitsOnly.length <= 3 && !isNaN(parseFloat(value)) && parseFloat(value) >= 0 && parseFloat(value) <= 999) {
                        form.setValue('case_study_2_minimum_score', parseFloat(value) || 0);
                      } else if (value === '' || value === '.') {
                        form.setValue('case_study_2_minimum_score', 0);
                      }
                    }}
                  />
                </div>
                <div>
                  <FormLabel>Nota Mínima Cotas</FormLabel>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="999"
                    maxLength={5}
                    placeholder="Ex: 5.0"
                    value={form.watch('case_study_2_minimum_score_cotas') || ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      // Limitar a 3 dígitos no total (ex: 999, 99.9, 9.99)
                      const digitsOnly = value.replace(/[^\d]/g, '');
                      if (digitsOnly.length <= 3 && !isNaN(parseFloat(value)) && parseFloat(value) >= 0 && parseFloat(value) <= 999) {
                        form.setValue('case_study_2_minimum_score_cotas', parseFloat(value) || 0);
                      } else if (value === '' || value === '.') {
                        form.setValue('case_study_2_minimum_score_cotas', 0);
                      }
                    }}
                  />
                </div>
              </div>
            </div>}
          
          {/* Estudo de Caso 3 */}
          {form.watch('has_case_study_3') && <div className="border p-4 rounded-md mb-4">
              <div className="flex justify-between items-center mb-4">
                <h5 className="font-medium">Estudo de Caso 3</h5>
                <Button variant="ghost" size="sm" onClick={() => form.setValue('has_case_study_3', false)} className="text-red-500 hover:text-red-700">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <FormLabel>Nota Mínima</FormLabel>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="999"
                    maxLength={5}
                    placeholder="Ex: 6.0"
                    value={form.watch('case_study_3_minimum_score') || ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      // Limitar a 3 dígitos no total (ex: 999, 99.9, 9.99)
                      const digitsOnly = value.replace(/[^\d]/g, '');
                      if (digitsOnly.length <= 3 && !isNaN(parseFloat(value)) && parseFloat(value) >= 0 && parseFloat(value) <= 999) {
                        form.setValue('case_study_3_minimum_score', parseFloat(value) || 0);
                      } else if (value === '' || value === '.') {
                        form.setValue('case_study_3_minimum_score', 0);
                      }
                    }}
                  />
                </div>
                <div>
                  <FormLabel>Nota Mínima Cotas</FormLabel>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="999"
                    maxLength={5}
                    placeholder="Ex: 5.0"
                    value={form.watch('case_study_3_minimum_score_cotas') || ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      // Limitar a 3 dígitos no total (ex: 999, 99.9, 9.99)
                      const digitsOnly = value.replace(/[^\d]/g, '');
                      if (digitsOnly.length <= 3 && !isNaN(parseFloat(value)) && parseFloat(value) >= 0 && parseFloat(value) <= 999) {
                        form.setValue('case_study_3_minimum_score_cotas', parseFloat(value) || 0);
                      } else if (value === '' || value === '.') {
                        form.setValue('case_study_3_minimum_score_cotas', 0);
                      }
                    }}
                  />
                </div>
              </div>
            </div>}
          
          {/* Outro Subjetivo */}
          {form.watch('has_other_subjective') && <div className="border p-4 rounded-md mb-4">
              <div className="flex justify-between items-center mb-4">
                <h5 className="font-medium">Outro</h5>
                <Button variant="ghost" size="sm" onClick={() => {
                  form.setValue('has_other_subjective', false);
                  form.setValue('other_subjective_name', '');
                }} className="text-red-500 hover:text-red-700">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <FormLabel>Nome da Seção</FormLabel>
                  <Input 
                    placeholder="Ex: Prova Prática, Redação, etc." 
                    value={form.watch('other_subjective_name') || ''} 
                    onChange={(e) => form.setValue('other_subjective_name', e.target.value)}
                  />
                </div>
                <div>
                  <FormLabel>Nota Mínima</FormLabel>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="999"
                    maxLength={5}
                    placeholder="Ex: 6.0"
                    value={form.watch('other_subjective_minimum_score') || ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      // Limitar a 3 dígitos no total (ex: 999, 99.9, 9.99)
                      const digitsOnly = value.replace(/[^\d]/g, '');
                      if (digitsOnly.length <= 3 && !isNaN(parseFloat(value)) && parseFloat(value) >= 0 && parseFloat(value) <= 999) {
                        form.setValue('other_subjective_minimum_score', parseFloat(value) || 0);
                      } else if (value === '' || value === '.') {
                        form.setValue('other_subjective_minimum_score', 0);
                      }
                    }}
                  />
                </div>
                <div>
                  <FormLabel>Nota Mínima Cotas</FormLabel>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="999"
                    maxLength={5}
                    placeholder="Ex: 5.0"
                    value={form.watch('other_subjective_minimum_score_cotas') || ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      // Limitar a 3 dígitos no total (ex: 999, 99.9, 9.99)
                      const digitsOnly = value.replace(/[^\d]/g, '');
                      if (digitsOnly.length <= 3 && !isNaN(parseFloat(value)) && parseFloat(value) >= 0 && parseFloat(value) <= 999) {
                        form.setValue('other_subjective_minimum_score_cotas', parseFloat(value) || 0);
                      } else if (value === '' || value === '.') {
                        form.setValue('other_subjective_minimum_score_cotas', 0);
                      }
                    }}
                  />
                </div>
              </div>
            </div>}
        </div>
      </CardContent>
    </Card>;
};

// Adicionando uma exportação com o nome esperado pela GeneralTab
export const ExamStructureSection = ExamStructureSectionComponent;