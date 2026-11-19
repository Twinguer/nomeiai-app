import React, { useState, useEffect } from 'react';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';

const ESTADOS_BRASILEIROS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

interface RankingHierarchySectionProps {
  form: any;
}

export const RankingHierarchySection: React.FC<RankingHierarchySectionProps> = ({ form }) => {
  const { toast } = useToast();
  const [generalCards, setGeneralCards] = useState<Array<{ id: string; titulo: string; orgao: string; is_unified: boolean }>>([]);
  const [loadingGeneralCards, setLoadingGeneralCards] = useState(false);
  
  const rankingType = form.watch('ranking_type') || 'general';
  const selectedParentId = form.watch('parent_concurso_id');
  const selectedParent = generalCards.find(c => c.id === selectedParentId);
  const isUnified = form.watch('is_unified') || false;

  // Carregar cards gerais quando o tipo for "position" ou quando houver parent_concurso_id pré-selecionado
  useEffect(() => {
    if (rankingType === 'position' || selectedParentId) {
      loadGeneralCards();
    }
  }, [rankingType, selectedParentId]);

  const loadGeneralCards = async () => {
    setLoadingGeneralCards(true);
    try {
      // Primeiro, tentar verificar se a coluna existe fazendo uma query simples
      const { error: testError } = await supabase
        .from('concursos')
        .select('is_general_card')
        .limit(1);
      
      // Se a coluna não existe, retornar array vazio
      if (testError && (testError.message?.includes('is_general_card') || 
                        testError.message?.includes('does not exist'))) {
        setGeneralCards([]);
        toast({
          title: 'Migração necessária',
          description: 'As colunas de hierarquia ainda não foram criadas. Aplique a migração SQL primeiro.',
          variant: 'default'
        });
        setLoadingGeneralCards(false);
        return;
      }
      
      // Se a coluna existe, fazer a query completa
      const { data, error } = await supabase
        .from('concursos')
        .select('id, titulo, orgao, is_unified')
        .eq('is_general_card', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setGeneralCards(data || []);
    } catch (error: any) {
      toast({
        title: 'Erro ao carregar cards gerais',
        description: error.message || 'Não foi possível carregar os cards gerais disponíveis.',
        variant: 'destructive'
      });
    } finally {
      setLoadingGeneralCards(false);
    }
  };

  const handleRankingTypeChange = (value: string) => {
    form.setValue('ranking_type', value);
    
    if (value === 'general') {
      // Limpar campos de cargo
      form.setValue('parent_concurso_id', null);
      form.setValue('cargo', '');
      form.setValue('state_uf', null);
    } else {
      // Limpar campo de unificado (só card geral pode ser unificado)
      form.setValue('is_unified', false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tipo de Ranking</CardTitle>
        <CardDescription>
          Escolha se está criando um card geral (sem cargo) ou um card de cargo específico
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <FormField
          control={form.control}
          name="ranking_type"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <RadioGroup
                  value={field.value || 'general'}
                  onValueChange={(value) => {
                    field.onChange(value);
                    handleRankingTypeChange(value);
                  }}
                  className="space-y-3"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="general" id="general" />
                    <Label htmlFor="general" className="cursor-pointer">
                      Card Geral (sem cargo específico)
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="position" id="position" />
                    <Label htmlFor="position" className="cursor-pointer">
                      Card de Cargo (vinculado a um card geral)
                    </Label>
                  </div>
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Seção para Card Geral */}
        {rankingType === 'general' && (
          <FormField
            control={form.control}
            name="is_unified"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
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
                    Marque esta opção se o concurso é nacional e cada estado tem seus próprios cargos
                  </p>
                </div>
              </FormItem>
            )}
          />
        )}

        {/* Seção para Card de Cargo */}
        {rankingType === 'position' && (
          <div className="space-y-4">
            <FormField
              control={form.control}
              name="parent_concurso_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Card Geral <span className="text-red-500">*</span></FormLabel>
                  <Select
                    value={field.value || ''}
                    onValueChange={(value) => {
                      field.onChange(value);
                      // Carregar informações do parent selecionado
                      const parent = generalCards.find(c => c.id === value);
                      if (parent) {
                        form.setValue('is_unified', parent.is_unified);
                        // Se não for unificado, limpar state_uf
                        if (!parent.is_unified) {
                          form.setValue('state_uf', null);
                        }
                      }
                    }}
                    disabled={loadingGeneralCards}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={loadingGeneralCards ? "Carregando..." : "Selecione o card geral"} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {generalCards.length === 0 && !loadingGeneralCards && (
                        <SelectItem value="none" disabled>
                          Nenhum card geral disponível
                        </SelectItem>
                      )}
                      {generalCards.map((card) => (
                        <SelectItem key={card.id} value={card.id}>
                          {card.titulo} - {card.orgao}
                          {card.is_unified && ' (Unificado)'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {loadingGeneralCards && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Carregando cards gerais...
                    </div>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

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
                      disabled={!selectedParentId}
                      maxLength={50}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Seletor de Estado (apenas se o card geral for unificado) */}
            {selectedParent?.is_unified && (
              <FormField
                control={form.control}
                name="state_uf"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estado/UF <span className="text-red-500">*</span></FormLabel>
                    <Select
                      value={field.value || ''}
                      onValueChange={field.onChange}
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
          </div>
        )}
      </CardContent>
    </Card>
  );
};
