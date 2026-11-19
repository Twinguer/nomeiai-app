import React, { useState, useEffect } from 'react';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StateSelector } from '../FormSections/StateSelector';
import { RankingHierarchySection } from './RankingHierarchySection';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';
import { validateFileUploadSimple } from '@/utils/fileUploadValidator';
import { devLog, sanitizeForLog } from '@/utils/productionLogger';

const ESTADOS_BRASILEIROS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];
interface BasicInfoSectionProps {
  form: any;
  jobTitles: Array<{
    id: string;
    title: string;
  }>;
  isCustomTitle: boolean;
  isCustomBanca: boolean;
  handleJobTitleChange: (value: string) => void;
  handleCustomTitleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleBancaChange: (value: string) => void;
  handleOrgaoChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  selectedStates: string[];
  setSelectedStates: React.Dispatch<React.SetStateAction<string[]>>;
}
export const BasicInfoSection: React.FC<BasicInfoSectionProps> = ({
  form,
  jobTitles,
  isCustomTitle,
  isCustomBanca,
  handleJobTitleChange,
  handleCustomTitleChange,
  handleBancaChange,
  handleOrgaoChange,
  selectedStates,
  setSelectedStates
}) => {
  const { toast } = useToast();
  const [uploadingWatermark, setUploadingWatermark] = useState(false);
  const [parentCard, setParentCard] = useState<{ id: string; titulo: string; orgao: string; banca: string; is_unified: boolean } | null>(null);
  const [loadingParent, setLoadingParent] = useState(false);

  const handleWatermarkUpload = async (e: React.ChangeEvent<HTMLInputElement>, onChange: (value: string) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar arquivo usando o sistema padronizado
    const validation = validateFileUploadSimple(file, 'WATERMARK', true);
    
    if (!validation.isValid) {
      toast({
        title: 'Arquivo inválido',
        description: validation.errors.join('. '),
        variant: 'destructive'
      });
      return;
    }

    setUploadingWatermark(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `watermark-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `rankings/${fileName}`;
      
      const { data, error } = await supabase.storage
        .from('profiles')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });
      
      if (error) {
        throw error;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('profiles')
        .getPublicUrl(filePath);

      onChange(publicUrl);
      toast({
        title: 'Imagem enviada',
        description: 'A marca dágua foi enviada com sucesso.'
      });
    } catch (error: any) {
      devLog.error('Erro ao fazer upload:', error);
      toast({
        title: 'Erro ao fazer upload',
        description: error.message || 'Ocorreu um erro ao enviar a imagem. Tente novamente.',
        variant: 'destructive'
      });
    } finally {
      setUploadingWatermark(false);
    }
  };

  // Verificar se já temos um parent_id (criando cargo)
  const parentId = form.watch('parent_concurso_id');
  const rankingType = form.watch('ranking_type');
  const isPositionCard = !!parentId || rankingType === 'position';

  // Carregar informações do parent quando houver parentId
  useEffect(() => {
    if (parentId) {
      loadParentCard(parentId);
    } else {
      setParentCard(null);
    }
  }, [parentId]);

  const loadParentCard = async (parentIdToLoad: string) => {
    if (!parentIdToLoad) return;
    setLoadingParent(true);
    try {
      const { data, error } = await supabase
        .from('concursos')
        .select('id, titulo, orgao, banca, is_unified')
        .eq('id', parentIdToLoad)
        .single();

      if (error) throw error;
      setParentCard(data);
      
      // Herdar automaticamente os dados do parent no formulário quando for cargo
      if (data) {
        // Atualizar is_unified no form
        if (data.is_unified !== undefined) {
          form.setValue('is_unified', data.is_unified);
        }
        // Herdar título, órgão e banca do parent (preencher campos automaticamente)
        // IMPORTANTE: Preencher todos os campos necessários para validação
        if (data.titulo) {
          form.setValue('orgao', data.titulo);
        }
        if (data.orgao) {
          // Para cargo, o campo 'orgao' do parent é o título do concurso
          // Preencher também o 'predefined_job_title' se necessário para validação
          form.setValue('predefined_job_title', data.orgao);
        }
        if (data.banca) {
          form.setValue('banca', data.banca);
        }
        // Garantir que o título também seja preenchido
        if (data.titulo) {
          // O título do parent vai para o campo 'orgao' (título do concurso)
          // Mas também precisamos garantir que está preenchido
        }
      }
    } catch (error: any) {
      toast({
        title: 'Erro ao carregar card geral',
        description: error.message || 'Não foi possível carregar as informações do card geral.',
        variant: 'destructive'
      });
    } finally {
      setLoadingParent(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Seção de Hierarquia de Rankings - apenas se não for cargo */}
      {!isPositionCard && <RankingHierarchySection form={form} />}
      
      {/* Campos específicos para cargo (quando há parentId) */}
      {isPositionCard && (
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-lg font-semibold mb-4">Informações do Cargo</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {loadingParent ? (
                <div className="col-span-2 flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Carregando informações do card geral...</span>
                </div>
              ) : (
                <>
                  {parentCard && (
                    <div className="col-span-2 p-3 bg-muted rounded-md">
                      <p className="text-sm font-medium">Card Geral:</p>
                      <p className="text-sm text-muted-foreground">{parentCard.titulo} - {parentCard.orgao}</p>
                    </div>
                  )}
                  
                  <FormField
                    control={form.control}
                    name="cargo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome do Cargo <span className="text-red-500">*</span></FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="Ex: Analista Administrativo"
                            disabled={loadingParent}
                            maxLength={50}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Seletor de Estado (apenas se o card geral for unificado) */}
                  {parentCard?.is_unified && (
                    <FormField
                      control={form.control}
                      name="state_uf"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Estado/UF <span className="text-red-500">*</span></FormLabel>
                          <Select
                            value={field.value || ''}
                            onValueChange={field.onChange}
                            disabled={loadingParent}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione o estado" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {ESTADOS_BRASILEIROS.map((estado) => (
                                <SelectItem key={estado} value={estado}>
                                  {estado}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Card "Informações Gerais" - NÃO mostrar quando for cargo (campos vêm do parent) */}
      {!isPositionCard && (
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-lg font-semibold mb-4">Informações Gerais</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Órgão */}
            <div>
              <FormField control={form.control} name="predefined_job_title" render={({
              field
            }) => <FormItem>
                    <FormLabel>Órgão <span className="text-red-500">*</span></FormLabel>
                  <Select value={field.value} onValueChange={value => {
              field.onChange(value);
              handleJobTitleChange(value);
            }}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um Órgão" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {jobTitles.filter(job => job.title !== 'OUTRO').sort((a, b) => a.title.localeCompare(b.title)).map(job => <SelectItem key={job.id} value={job.title}>
                            {job.title}
                          </SelectItem>)}
                      <SelectItem value="OUTRO">OUTRO</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>} />
            
            {isCustomTitle && <FormField control={form.control} name="custom_job_title" render={({
            field
          }) => <FormItem className="mt-2">
                    <FormLabel>Órgão personalizado <span className="text-red-500">*</span></FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="Digite o cargo" 
                        maxLength={20}
                        onChange={e => {
                const up = e.target.value.toUpperCase().slice(0, 20);
                field.onChange(up);
                handleCustomTitleChange({
                  ...e,
                  target: {
                    ...e.target,
                    value: up
                  }
                });
              }} />
                    </FormControl>
                  </FormItem>} />}
            </div>
            
            {/* Título do Concurso */}
            <FormField control={form.control} name="orgao" render={({
            field
          }) => <FormItem>
                  <FormLabel>Título do Concurso</FormLabel>
                <FormControl>
                  <Input 
                    {...field} 
                    placeholder="Digite o Cargo - Especialidade" 
                    maxLength={20}
                    onChange={e => {
              const up = e.target.value.toUpperCase().slice(0, 20);
              field.onChange(up);
              handleOrgaoChange({
                ...e,
                target: {
                  ...e.target,
                  value: up
                }
              });
            }} />
                </FormControl>
              </FormItem>} />
          
          {/* Localidade */}
          <div className="col-span-2">
            <StateSelector form={form} selectedStates={selectedStates} setSelectedStates={setSelectedStates} />
          </div>
          
          {/* Banca */}
          <div>
            <FormField control={form.control} name="banca" render={({
            field
          }) => <FormItem>
                  <FormLabel>Banca <span className="text-red-500">*</span></FormLabel>
                  <Select value={field.value} onValueChange={value => {
              field.onChange(value);
              handleBancaChange(value);
            }}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma banca" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Cebraspe">Cebraspe</SelectItem>
                      <SelectItem value="FGV">FGV</SelectItem>
                      <SelectItem value="VUNESP">VUNESP</SelectItem>
                      <SelectItem value="FCC">FCC</SelectItem>
                      <SelectItem value="FUNDATEC">FUNDATEC</SelectItem>
                      <SelectItem value="OUTRO">Outro (especificar)</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>} />
            
            {isCustomBanca && <FormField control={form.control} name="custom_banca" render={({
            field
          }) => <FormItem className="mt-2">
                    <FormLabel>Banca personalizada <span className="text-red-500">*</span></FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="Digite o nome da banca" 
                        maxLength={20}
                        onChange={e => {
                          const value = e.target.value.toUpperCase().slice(0, 20);
                          field.onChange(value);
                        }}
                      />
                    </FormControl>
                  </FormItem>} />}
          </div>
          
          {/* Data da Prova */}
          <FormField control={form.control} name="created_at" render={({
          field
        }) => <FormItem>
                <FormLabel>Data da Prova</FormLabel>
                <FormControl>
                  <Input 
                    type="date" 
                    value={field.value || ''} 
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    name={field.name}
                    ref={field.ref}
                  />
                </FormControl>
              </FormItem>} />
          
          {/* Status do Concurso */}
          <FormField control={form.control} name="status" render={({
          field
        }) => <FormItem>
                <FormLabel>Status do Concurso</FormLabel>
                <Select value={field.value || ''} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o status" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="Concluído">Concluído</SelectItem>
                    <SelectItem value="Suspenso">Suspenso</SelectItem>
                    <SelectItem value="Cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>} />
          
          {/* Etapa Atual */}
          <FormField control={form.control} name="etapa_atual" render={({
          field
        }) => <FormItem>
                <FormLabel>Etapa Atual</FormLabel>
                <Select value={field.value || ''} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a etapa" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="Inscrições">Inscrições</SelectItem>
                    <SelectItem value="Prova Objetiva">Prova Objetiva</SelectItem>
                    <SelectItem value="Prova Discursiva">Prova Discursiva</SelectItem>
                    <SelectItem value="Avaliação de Títulos">Avaliação de Títulos</SelectItem>
                    <SelectItem value="Curso de Formação">Curso de Formação</SelectItem>
                    <SelectItem value="Resultado Final">Resultado Final</SelectItem>
                    <SelectItem value="Nomeação">Nomeação</SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>} />
          
          {/* Link do Edital */}
          <FormField control={form.control} name="link" render={({
          field
        }) => <FormItem>
                <FormLabel>Link do Edital</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="https://..." />
                </FormControl>
              </FormItem>} />
          
          {/* Vagas */}
          <FormField control={form.control} name="vagas" render={({
          field
        }) => <FormItem>
                <FormLabel>Quantidade de Vagas</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    {...field} 
                    min="0" 
                    max="999999"
                    maxLength={6}
                    onChange={e => {
                      const value = e.target.value;
                      if (value.length <= 6 && !isNaN(Number(value)) && Number(value) <= 999999) {
                        field.onChange(Number(value));
                      }
                    }} 
                  />
                </FormControl>
              </FormItem>} />
          
          {/* Inscritos */}
          <FormField control={form.control} name="inscritos" render={({
          field
        }) => <FormItem>
                <FormLabel>Quantidade de Inscritos</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    {...field} 
                    min="0" 
                    max="999999"
                    maxLength={6}
                    onChange={e => {
                      const value = e.target.value;
                      if (value.length <= 6 && !isNaN(Number(value)) && Number(value) <= 999999) {
                        field.onChange(Number(value));
                      }
                    }} 
                  />
                </FormControl>
              </FormItem>} />
          
          {/* Upload de Marca d'Água */}
          <FormField 
            control={form.control} 
            name="watermark_image_url" 
            render={({ field }) => (
              <FormItem className="col-span-2">
                <FormLabel>Imagem de Marca d'Água (Opcional)</FormLabel>
                <FormControl>
                  <div className="space-y-2">
                    <Input
                      type="file"
                      accept="image/*"
                      disabled={uploadingWatermark}
                      onChange={(e) => handleWatermarkUpload(e, field.onChange)}
                      className="cursor-pointer"
                    />
                    {uploadingWatermark && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Enviando imagem...</span>
                      </div>
                    )}
                    {field.value && !uploadingWatermark && (
                      <div className="mt-2 space-y-2">
                        <img 
                          src={field.value} 
                          alt="Preview marca d'água" 
                          className="max-w-xs max-h-32 object-contain border rounded p-2 bg-muted"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => field.onChange('')}
                          className="text-xs"
                        >
                          Remover imagem
                        </Button>
                      </div>
                    )}
                  </div>
                </FormControl>
              </FormItem>
            )} 
          />
          </div>
        </CardContent>
      </Card>
      )}
    </div>
  );
};