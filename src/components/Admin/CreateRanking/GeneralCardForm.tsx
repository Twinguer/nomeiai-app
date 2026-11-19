import React, { useState, useEffect } from 'react';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';
import { StateSelector } from '@/components/Admin/FormSections/StateSelector';
import { validateFileUploadSimple } from '@/utils/fileUploadValidator';

interface GeneralCardFormProps {
  form: any;
  jobTitles: Array<{ id: string; title: string }>;
  isCustomTitle: boolean;
  isCustomBanca: boolean;
  handleJobTitleChange: (value: string) => void;
  handleCustomTitleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleBancaChange: (value: string) => void;
  handleOrgaoChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSave: () => Promise<void>;
  isSubmitting: boolean;
  selectedStates: string[];
  setSelectedStates: React.Dispatch<React.SetStateAction<string[]>>;
}

export const GeneralCardForm: React.FC<GeneralCardFormProps> = ({
  form,
  jobTitles,
  isCustomTitle,
  isCustomBanca,
  handleJobTitleChange,
  handleCustomTitleChange,
  handleBancaChange,
  handleOrgaoChange,
  onSave,
  isSubmitting,
  selectedStates,
  setSelectedStates
}) => {
  const { toast } = useToast();
  const [uploadingWatermark, setUploadingWatermark] = useState(false);
  
  // Observar is_unified para controlar localidade
  const isUnified = form.watch('is_unified') || false;

  // Limpar localidades quando marcar como unificado
  useEffect(() => {
    if (isUnified && selectedStates.length > 0) {
      setSelectedStates([]);
      form.setValue('localidades', [], { shouldDirty: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isUnified]);

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
      
      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('profiles')
        .getPublicUrl(filePath);

      onChange(publicUrl);
      toast({
        title: 'Imagem enviada',
        description: 'A marca dágua foi enviada com sucesso.'
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao fazer upload',
        description: error.message || 'Ocorreu um erro ao enviar a imagem. Tente novamente.',
        variant: 'destructive'
      });
    } finally {
      setUploadingWatermark(false);
    }
  };

  // Garantir que o tipo seja sempre "general" para card geral
  useEffect(() => {
    form.setValue('ranking_type', 'general');
    form.setValue('is_general_card', true);
    form.setValue('parent_concurso_id', null);
  }, [form]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Informações do Card Geral</CardTitle>
          <CardDescription>
            Preencha as informações básicas do concurso. Os detalhes da prova serão configurados ao criar cada cargo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Órgão */}
            <FormField 
              control={form.control} 
              name="predefined_job_title" 
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Órgão <span className="text-red-500">*</span></FormLabel>
                  <Select 
                    value={field.value} 
                    onValueChange={(value) => {
                      field.onChange(value);
                      handleJobTitleChange(value);
                    }}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um Órgão" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {jobTitles
                        .filter(job => job.title !== 'OUTRO')
                        .sort((a, b) => a.title.localeCompare(b.title))
                        .map(job => (
                          <SelectItem key={job.id} value={job.title}>
                            {job.title}
                          </SelectItem>
                        ))}
                      <SelectItem value="OUTRO">OUTRO</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} 
            />
            
            {isCustomTitle && (
              <FormField 
                control={form.control} 
                name="custom_job_title" 
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Órgão personalizado <span className="text-red-500">*</span></FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="Digite o órgão" 
                        maxLength={20}
                        onChange={(e) => {
                          const up = e.target.value.toUpperCase().slice(0, 20);
                          field.onChange(up);
                          handleCustomTitleChange({
                            ...e,
                            target: { ...e.target, value: up }
                          });
                        }} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} 
              />
            )}

            {/* Título/Concurso */}
            <FormField 
              control={form.control} 
              name="orgao" 
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Título do Concurso</FormLabel>
                  <FormControl>
                    <Input 
                      {...field} 
                      placeholder="Ex: CNU 2025" 
                      maxLength={100}
                      onChange={(e) => {
                        const up = e.target.value.toUpperCase().slice(0, 100);
                        field.onChange(up);
                        handleOrgaoChange({
                          ...e,
                          target: { ...e.target, value: up }
                        });
                      }} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} 
            />

            {/* Banca */}
            <FormField 
              control={form.control} 
              name="banca" 
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Banca <span className="text-red-500">*</span></FormLabel>
                  <Select 
                    value={field.value} 
                    onValueChange={(value) => {
                      field.onChange(value);
                      handleBancaChange(value);
                    }}
                  >
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
                  <FormMessage />
                </FormItem>
              )} 
            />
            
            {isCustomBanca && (
              <FormField 
                control={form.control} 
                name="custom_banca" 
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Banca personalizada <span className="text-red-500">*</span></FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="Digite o nome da banca" 
                        maxLength={50}
                        onChange={(e) => {
                          const value = e.target.value.toUpperCase().slice(0, 50);
                          field.onChange(value);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} 
              />
            )}

            {/* Data da Prova */}
            <FormField 
              control={form.control} 
              name="created_at" 
              render={({ field }) => (
                <FormItem>
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
                  <FormMessage />
                </FormItem>
              )} 
            />

            {/* Link do Edital */}
            <FormField 
              control={form.control} 
              name="link" 
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Link do Edital</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="https://..." />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} 
            />

            {/* Localidade - Mostrar apenas se NÃO for unificado */}
            {!isUnified && (
              <div className="col-span-2">
                <StateSelector 
                  form={form} 
                  selectedStates={selectedStates} 
                  setSelectedStates={setSelectedStates} 
                />
              </div>
            )}

            {/* Vagas */}
            <FormField 
              control={form.control} 
              name="vagas" 
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vagas (Total)</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      {...field} 
                      min="0" 
                      max="999999"
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value.length <= 6 && !isNaN(Number(value)) && Number(value) <= 999999) {
                          field.onChange(Number(value));
                        }
                      }} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} 
            />

            {/* Inscritos */}
            <FormField 
              control={form.control} 
              name="inscritos" 
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Inscritos (Total)</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      {...field} 
                      min="0" 
                      max="999999"
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value.length <= 6 && !isNaN(Number(value)) && Number(value) <= 999999) {
                          field.onChange(Number(value));
                        }
                      }} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} 
            />

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
                  <FormMessage />
                </FormItem>
              )} 
            />

            {/* Concurso Unificado */}
            <FormField
              control={form.control}
              name="is_unified"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 col-span-2">
                  <FormControl>
                    <Checkbox
                      checked={field.value || false}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel className="cursor-pointer">
                      Este é um concurso unificado/nacional
                    </FormLabel>
                    <p className="text-sm text-muted-foreground">
                      Marque esta opção se o concurso é nacional e cada estado tem seus próprios cargos.
                      {isUnified && (
                        <span className="block mt-1 text-xs text-amber-600 dark:text-amber-400">
                          ⚠️ Quando marcado como unificado, a localidade será definida em cada card de cargo individual.
                        </span>
                      )}
                    </p>
                  </div>
                </FormItem>
              )}
            />
          </div>

          <div className="flex justify-end pt-4">
            <Button 
              type="button"
              onClick={onSave}
              disabled={isSubmitting}
              size="lg"
            >
              {isSubmitting ? 'Salvando...' : 'Criar Card Geral'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

