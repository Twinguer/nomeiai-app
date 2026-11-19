import React from 'react';
import { FormField, FormItem, FormLabel, FormControl, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
interface MinimumScoreSectionProps {
  form: any;
}
export const MinimumScoreSection: React.FC<MinimumScoreSectionProps> = ({ form }) => {
  return (
    <Card className="mb-6">
      <CardContent className="pt-6">
        <div className="mb-4">
          <h3 className="text-lg font-semibold mb-4">Pontuações Mínimas Globais da Prova</h3>
          
          <FormField
            control={form.control}
            name="minimumTotalScore"
            render={({ field }) => (
              <FormItem className="mb-4">
                <FormControl>
                  <Input 
                    type="number" 
                    step="0.01" 
                    min="0" 
                    max="999"
                    maxLength={5}
                    {...field} 
                    value={field.value || 0} 
                    onChange={e => {
                      const value = e.target.value;
                      // Limitar a 3 dígitos no total (ex: 999, 99.9, 9.99)
                      const digitsOnly = value.replace(/[^\d]/g, '');
                      if (digitsOnly.length <= 3 && !isNaN(parseFloat(value)) && parseFloat(value) >= 0 && parseFloat(value) <= 999) {
                        field.onChange(parseFloat(value) || 0);
                      } else if (value === '' || value === '.') {
                        field.onChange(0);
                      }
                    }} 
                    className="w-full md:w-1/3" 
                  />
                </FormControl>
              </FormItem>
            )}
          />
          
          <Separator className="my-4" />
          
          <div className="mb-4">
            <h4 className="text-md font-semibold mb-3">Pontuação Mínima para Cotas</h4>
            
            <FormField
              control={form.control}
              name="minimumTotalScoreCotas"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input 
                      type="number" 
                      step="0.01" 
                      min="0" 
                      max="999"
                      maxLength={5}
                      {...field} 
                      value={field.value || 0} 
                      onChange={e => {
                        const value = e.target.value;
                        // Limitar a 3 dígitos no total (ex: 999, 99.9, 9.99)
                        const digitsOnly = value.replace(/[^\d]/g, '');
                        if (digitsOnly.length <= 3 && !isNaN(parseFloat(value)) && parseFloat(value) >= 0 && parseFloat(value) <= 999) {
                          field.onChange(parseFloat(value) || 0);
                        } else if (value === '' || value === '.') {
                          field.onChange(0);
                        }
                      }} 
                      className="w-full md:w-1/3" 
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};