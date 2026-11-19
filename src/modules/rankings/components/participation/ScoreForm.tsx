// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Concurso } from '@/types/concursos';
import { useQueryClient } from '@tanstack/react-query';
import { formatScore } from '@/lib/utils';
import { devLog, sanitizeForLog } from '@/utils/productionLogger';
import { RPCValidator } from '@/utils/rpcValidator';

interface ScoreFormProps {
  concurso: Concurso;
  rankingId: string;
  userId: string;
  onSuccess: () => void;
}

// Definir a interface FormValues para resolver o problema de tipagem
interface FormValues {
  basicKnowledgeScore: number;
  specificKnowledge1Score: number;
  specificKnowledge2Score: number;
  specificKnowledge3Score: number;
  discursiveScore: number;
  caseStudy1Score: number;
  caseStudy2Score: number;
  caseStudy3Score: number;
  otherSubjectiveScore: number;
  [key: string]: number; // Para campos dinâmicos como customDiscipline_*
}

// Create a dynamic form schema that includes custom disciplines
const createFormSchema = (concurso?: Concurso) => {
  const baseSchema: Record<string, any> = {
    basicKnowledgeScore: z.coerce.number()
      .min(0, 'A nota não pode ser negativa')
      .max(100, 'A nota não pode ser maior que 100'),
    specificKnowledge1Score: z.coerce.number()
      .min(0, 'A nota não pode ser negativa')
      .max(100, 'A nota não pode ser maior que 100'),
    specificKnowledge2Score: z.coerce.number()
      .min(0, 'A nota não pode ser negativa')
      .max(100, 'A nota não pode ser maior que 100'),
    specificKnowledge3Score: z.coerce.number()
      .min(0, 'A nota não pode ser negativa')
      .max(100, 'A nota não pode ser maior que 100'),
    discursiveScore: z.coerce.number()
      .min(0, 'A nota não pode ser negativa')
      .max(100, 'A nota não pode ser maior que 100'),
    caseStudy1Score: z.coerce.number()
      .min(0, 'A nota não pode ser negativa')
      .max(100, 'A nota não pode ser maior que 100'),
    caseStudy2Score: z.coerce.number()
      .min(0, 'A nota não pode ser negativa')
      .max(100, 'A nota não pode ser maior que 100'),
    caseStudy3Score: z.coerce.number()
      .min(0, 'A nota não pode ser negativa')
      .max(100, 'A nota não pode ser maior que 100'),
    otherSubjectiveScore: z.coerce.number()
      .min(0, 'A nota não pode ser negativa')
      .max(100, 'A nota não pode ser maior que 100'),
  };

  // Add custom discipline fields if they exist
  if (concurso?.disciplines && Array.isArray(concurso.disciplines)) {
    concurso.disciplines.forEach(discipline => {
      if (discipline.isEnabled && discipline.type) {
        baseSchema[`customDiscipline_${discipline.type}`] = z.coerce.number()
          .min(0, 'A nota não pode ser negativa')
          .max(100, 'A nota não pode ser maior que 100');
      }
    });
  }

  return z.object(baseSchema);
};

export const ScoreForm: React.FC<ScoreFormProps> = ({ concurso, rankingId, userId, onSuccess }) => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const queryClient = useQueryClient();

  // Create the form schema based on the concurso
  const formSchema = createFormSchema(concurso);
  type FormValues = z.infer<typeof formSchema>;

  // Generate default values including custom disciplines
  const generateDefaultValues = () => {
    const defaultValues: any = {
      basicKnowledgeScore: 0,
      specificKnowledge1Score: 0,
      specificKnowledge2Score: 0,
      specificKnowledge3Score: 0,
      discursiveScore: 0,
      caseStudy1Score: 0,
      caseStudy2Score: 0,
      caseStudy3Score: 0,
      otherSubjectiveScore: 0,
    };

    // Add custom discipline default values
    if (concurso?.disciplines && Array.isArray(concurso.disciplines)) {
      concurso.disciplines.forEach(discipline => {
        if (discipline.isEnabled && discipline.type) {
          defaultValues[`customDiscipline_${discipline.type}`] = 0;
        }
      });
    }

    return defaultValues;
  };

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: generateDefaultValues(),
  });


  const onSubmit = async (values: FormValues) => {
    setIsSubmitting(true);
    try {
      // ✅ VALIDAÇÃO: Validar inputs antes de enviar
      let validatedConcursoId: string;
      let validatedUserId: string;
      let validatedScores: any;
      
      try {
        validatedConcursoId = RPCValidator.validateUUID(concurso.id, 'ID do concurso');
        validatedUserId = RPCValidator.validateUUID(userId, 'ID do usuário');
        
        // Validar pontuações
        validatedScores = RPCValidator.validateSubjectiveScores({
          discursive: values.discursive_score || 0,
          case_study_1: values.case_study_1_score || 0,
          case_study_2: values.case_study_2_score || 0,
          case_study_3: values.case_study_3_score || 0
        });
      } catch (validationError: any) {
        toast({
          title: "Erro de validação",
          description: validationError.message || "Dados inválidos. Verifique os campos e tente novamente.",
          variant: "destructive"
        });
        setIsSubmitting(false);
        return;
      }
      
      // Chamar função RPC do backend para calcular pontuações com pesos
      const { data: calculationResult, error: calculationError } = await supabase.rpc(
        'calculate_weighted_scores',
        {
          p_concurso_id: validatedConcursoId,
          p_scores: { ...values, ...validatedScores },
          p_user_id: validatedUserId
        }
      );

      if (calculationError) {
        devLog.error('Erro no cálculo de pontuações:', calculationError);
        throw new Error('Erro no cálculo de pontuações: ' + calculationError.message);
      }

      if (calculationResult.error) {
        throw new Error(calculationResult.error);
      }

      // Debug logs removed for security
      
      // Preparar dados para atualização usando resultado do backend
      const scoreData = {
        basic_knowledge_score: calculationResult.basic_knowledge_score,
        specific_knowledge_1_score: calculationResult.specific_knowledge_1_score,
        specific_knowledge_2_score: calculationResult.specific_knowledge_2_score,
        specific_knowledge_3_score: calculationResult.specific_knowledge_3_score,
        specific_knowledge_score: calculationResult.specific_knowledge_score,
        discursive_score: calculationResult.discursive_score,
        case_study_1_score: calculationResult.case_study_1_score,
        case_study_2_score: calculationResult.case_study_2_score,
        case_study_3_score: calculationResult.case_study_3_score,
        custom_discipline_scores: calculationResult.custom_discipline_scores,
        weighted_custom_discipline_scores: calculationResult.weighted_custom_discipline_scores,
        score: calculationResult.total_score,
        all_questions_answered: true, // Since user is manually entering scores
        updated_at: new Date().toISOString()
      };
      
      // Atualizar ranking do usuário
      const { error: updateError } = await supabase
        .from('user_rankings')
        .update(scoreData)
        .eq('user_id', userId);

      if (updateError) {
        devLog.error('Erro ao atualizar ranking:', updateError);
        throw updateError;
      }
      
      // Invalidar queries relacionadas para forçar refresh
      queryClient.invalidateQueries({ queryKey: ['rankings', concurso.id] });
      queryClient.invalidateQueries({ queryKey: ['participant-count', concurso.id] });
      queryClient.invalidateQueries({ queryKey: ['user-rankings', userId] });
      
      toast({
        title: 'Notas registradas com sucesso!',
        description: `Pontuação total calculada: ${formatScore(calculationResult.total_score)} pontos`,
      });
      
      // Pequeno delay para o toast aparecer antes do redirecionamento
      setTimeout(onSuccess, 1500);
    } catch (error) {
      devLog.error('Erro ao registrar notas:', error);
      toast({
        title: 'Erro ao registrar notas',
        description: 'Ocorreu um erro ao tentar registrar suas notas. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="max-w-lg mx-auto">
      <CardHeader>
        <CardTitle>Registrar suas notas - {concurso.titulo}</CardTitle>
        <CardDescription>
          Preencha abaixo com suas notas para participar do ranking deste concurso
        </CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            {/* Render disciplines from the new structure */}
            {concurso.disciplines && Array.isArray(concurso.disciplines) && concurso.disciplines.map((discipline, index) => {
              // Check if it's a hierarchical structure (block with disciplines)
              if ('disciplines' in discipline && Array.isArray(discipline.disciplines)) {
                // Render each discipline in the block
                return discipline.disciplines.map((subDiscipline: any, subIndex: number) => {
                  if (!subDiscipline.isEnabled) return null;
                  
                  const fieldName = `customDiscipline_${subDiscipline.type}`;
                  
                  return (
                    <FormField
                      key={`${index}-${subIndex}`}
                      control={form.control}
                      name={fieldName}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            {subDiscipline.name || subDiscipline.type}
                          </FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              step="0.01" 
                              placeholder="Ex: 80.5" 
                              {...field} 
                            />
                          </FormControl>
                          <FormDescription>
                            Sua nota em {subDiscipline.name || subDiscipline.type} (0-100)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  );
                });
              } else {
                // Flat structure - render discipline directly
                if (!discipline.isEnabled) return null;
                
                const fieldName = `customDiscipline_${discipline.type}`;
                
                return (
                  <FormField
                    key={index}
                    control={form.control}
                    name={fieldName}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {discipline.name || discipline.type}
                        </FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.01" 
                            placeholder="Ex: 80.5" 
                            {...field} 
                          />
                        </FormControl>
                        <FormDescription>
                          Sua nota em {discipline.name || discipline.type} (0-100)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                );
              }
            }).flat().filter(Boolean)}

            {/* Custom Disciplines Scores */}
            {concurso.disciplines && Array.isArray(concurso.disciplines) && 
              concurso.disciplines
                .filter(discipline => discipline.isEnabled)
                .map((discipline, index) => (
                  <FormField
                    key={`custom-discipline-${index}`}
                    control={form.control}
                    name={`customDiscipline_${discipline.type}`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {discipline.name}
                        </FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.01" 
                            placeholder={`Ex: 85.0`} 
                            {...field} 
                          />
                        </FormControl>
                        <FormDescription>
                          Sua nota em {discipline.name} (0-100)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ))
            }

            {/* Discursive Score */}
            {concurso.has_discursive && (
              <FormField
                control={form.control}
                name="discursiveScore"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Discursiva
                    </FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.01" 
                        placeholder="Ex: 70.0" 
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription>
                      Sua nota na parte discursiva (0-100)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Case Study 1 Score */}
            {concurso.has_case_study_1 && (
              <FormField
                control={form.control}
                name="caseStudy1Score"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Estudo de Caso 1
                    </FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.01" 
                        placeholder="Ex: 85.0" 
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription>
                      Sua nota no estudo de caso 1 (0-100)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Case Study 2 Score */}
            {concurso.has_case_study_2 && (
              <FormField
                control={form.control}
                name="caseStudy2Score"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Estudo de Caso 2
                    </FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.01" 
                        placeholder="Ex: 75.0" 
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription>
                      Sua nota no estudo de caso 2 (0-100)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Case Study 3 Score */}
            {concurso.has_case_study_3 && (
              <FormField
                control={form.control}
                name="caseStudy3Score"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Estudo de Caso 3
                    </FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.01" 
                        placeholder="Ex: 80.0" 
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription>
                      Sua nota no estudo de caso 3 (0-100)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Outro Subjetivo Score */}
            {concurso.has_other_subjective && (
              <FormField
                control={form.control}
                name="otherSubjectiveScore"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {concurso.other_subjective_name || 'Outro Subjetivo'}
                    </FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.01" 
                        placeholder="Ex: 75.0" 
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription>
                      Sua nota na seção subjetiva personalizada (0-100)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Registrando...
                </>
              ) : (
                'Registrar Notas'
              )}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
};
