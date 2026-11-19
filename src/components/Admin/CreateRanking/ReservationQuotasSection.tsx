import React, { useEffect } from 'react';
import { FormField, FormItem, FormLabel, FormControl } from '@/components/ui/form';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
interface ReservationQuotasSectionProps {
  form: any;
}
export const ReservationQuotasSection: React.FC<ReservationQuotasSectionProps> = ({
  form
}) => {
  
  return <Card>
      <CardContent className="pt-6">
        <h3 className="text-lg font-semibold mb-4">Cotas de Reserva</h3>
        
        <div className="space-y-2">
          <FormField control={form.control} name="has_ampla_concorrencia" render={({
          field
        }) => <FormItem className="flex items-center space-x-2">
                <FormControl>
                  <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
                <FormLabel className="text-sm font-normal">ac (Ampla Concorrência)</FormLabel>
              </FormItem>} />
          
          <FormField control={form.control} name="has_ppp" render={({
          field
        }) => <FormItem className="flex items-center space-x-2">
                <FormControl>
                  <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
                <FormLabel className="text-sm font-normal">ppp (Pessoas Pretas e Pardas)</FormLabel>
              </FormItem>} />
          
          <FormField control={form.control} name="has_pcd" render={({
          field
        }) => <FormItem className="flex items-center space-x-2">
                <FormControl>
                  <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
                <FormLabel className="text-sm font-normal">pcd (Pessoas com Deficiência)</FormLabel>
              </FormItem>} />
          
          <FormField control={form.control} name="has_hipossuficientes" render={({
          field
        }) => <FormItem className="flex items-center space-x-2">
                <FormControl>
                  <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
                <FormLabel className="text-sm font-normal">hip (Hipossuficientes)</FormLabel>
              </FormItem>} />
          
          <FormField control={form.control} name="has_indigenas" render={({
          field
        }) => <FormItem className="flex items-center space-x-2">
                <FormControl>
                  <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
                <FormLabel className="text-sm font-normal">ind (Indígenas)</FormLabel>
              </FormItem>} />
          
          <FormField control={form.control} name="has_transsexuais" render={({
          field
        }) => <FormItem className="flex items-center space-x-2">
                <FormControl>
                  <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
                <FormLabel className="text-sm font-normal">tra (Pessoas Trans)</FormLabel>
              </FormItem>} />
        </div>
      </CardContent>
    </Card>;
};