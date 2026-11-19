import React from 'react';
import { FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { UseFormReturn } from 'react-hook-form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StateSelector } from './StateSelector';

interface GeneralInfoSectionProps {
  form: UseFormReturn<any>;
  jobTitles: { id: string; title: string; }[];
  isCustomTitle: boolean;
  isCustomBanca: boolean;
  handleJobTitleChange: (value: string) => void;
  handleCustomTitleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleBancaChange: (value: string) => void;
}

export const GeneralInfoSection: React.FC<GeneralInfoSectionProps> = ({ 
  form, 
  jobTitles, 
  isCustomTitle, 
  isCustomBanca,
  handleJobTitleChange, 
  handleCustomTitleChange,
  handleBancaChange
}) => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField 
          control={form.control} 
          name="predefined_job_title" 
          render={({ field }) => (
            <FormItem>
              <FormLabel>Cargo</FormLabel>
              <Select 
                onValueChange={value => {
                  field.onChange(value);
                  handleJobTitleChange(value);
                }} 
                defaultValue={field.value} 
                value={field.value}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um cargo" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent className="max-h-80">
                  {jobTitles.map(jobTitle => (
                    <SelectItem key={jobTitle.id} value={jobTitle.title}>
                      {jobTitle.title}
                    </SelectItem>
                  ))}
                  <SelectItem value="OUTRO">Outro (personalizado)</SelectItem>
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
                <FormLabel>Especifique o cargo</FormLabel>
                <FormControl>
                  <Input 
                    {...field} 
                    onChange={e => {
                      field.onChange(e);
                      handleCustomTitleChange(e);
                    }} 
                  />
                </FormControl>
                <FormDescription>
                  Digite o nome completo do cargo
                </FormDescription>
                <FormMessage />
              </FormItem>
            )} 
          />
        )}
        
        <FormField 
          control={form.control} 
          name="orgao" 
          render={({ field }) => (
            <FormItem>
              <FormLabel>Orgão</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} 
        />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <FormField control={form.control} name="banca" render={({field}) => (
          <FormItem>
            <FormLabel>Banca</FormLabel>
            <Select onValueChange={value => {
              field.onChange(value);
              handleBancaChange(value);
            }} defaultValue={field.value}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma banca" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="Cebraspe">Cebraspe</SelectItem>
                <SelectItem value="FGV">FGV</SelectItem>
                <SelectItem value="FCC">FCC</SelectItem>
                <SelectItem value="IBFC">IBFC</SelectItem>
                <SelectItem value="Vunesp">Vunesp</SelectItem>
                <SelectItem value="OUTRO">Outra</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />
        
        {isCustomBanca && (
          <FormField 
            control={form.control} 
            name="custom_banca" 
            render={({ field }) => (
              <FormItem>
                <FormLabel>Especifique a banca</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormDescription>
                  Digite o nome da banca examinadora
                </FormDescription>
                <FormMessage />
              </FormItem>
            )} 
          />
        )}
        
        <FormField control={form.control} name="vagas" render={({field}) => (
          <FormItem>
            <FormLabel>Vagas</FormLabel>
            <FormControl>
              <Input 
                type="number" 
                min="0" 
                max="999999"
                maxLength={6}
                {...field} 
                onChange={e => {
                  const value = e.target.value;
                  if (value.length <= 6 && !isNaN(Number(value)) && Number(value) <= 999999) {
                    field.onChange(Number(value));
                  }
                }} 
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />
        
        <FormField control={form.control} name="inscritos" render={({field}) => (
          <FormItem>
            <FormLabel>Inscritos</FormLabel>
            <FormControl>
              <Input 
                type="number" 
                min="0" 
                max="999999"
                maxLength={6}
                {...field} 
                onChange={e => {
                  const value = e.target.value;
                  if (value.length <= 6 && !isNaN(Number(value)) && Number(value) <= 999999) {
                    field.onChange(Number(value));
                  }
                }} 
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />
        
        <FormField
          control={form.control}
          name="localidades"
          render={({ field }) => (
            <FormItem>
              <StateSelector
                selectedStates={field.value || []}
                onStateChange={(states) => field.onChange(states)}
              />
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <FormField control={form.control} name="created_at" render={({field}) => (
          <FormItem>
            <FormLabel>Data da Prova</FormLabel>
            <FormControl>
              <Input type="date" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />
        
        <FormField control={form.control} name="status" render={({field}) => (
          <FormItem>
            <FormLabel>Status</FormLabel>
            <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um status" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="Em andamento">Em andamento</SelectItem>
                <SelectItem value="Concluído">Concluído</SelectItem>
                <SelectItem value="Cancelado">Cancelado</SelectItem>
                <SelectItem value="Suspenso">Suspenso</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField control={form.control} name="exam_type" render={({field}) => (
          <FormItem>
            <FormLabel>Tipo de Prova</FormLabel>
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo de prova" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="Alternativas">Múltipla Escolha</SelectItem>
                <SelectItem value="Certo ou Errado">Certo ou Errado</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />
        
        <FormField control={form.control} name="alternatives_count" render={({field}) => (
          <FormItem>
            <FormLabel>Quantidade de Alternativas</FormLabel>
            <FormControl>
              <Input type="number" {...field} />
            </FormControl>
            <FormDescription>
              Para provas de Certo ou Errado, considere 2
            </FormDescription>
            <FormMessage />
          </FormItem>
        )} />
      </div>
    </div>
  );
};
