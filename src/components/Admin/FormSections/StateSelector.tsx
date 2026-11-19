
import React, { useEffect } from 'react';
import { FormField, FormItem, FormLabel } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { MapPin } from 'lucide-react';

interface StateSelectorProps {
  form?: any;
  selectedStates: string[];
  setSelectedStates?: React.Dispatch<React.SetStateAction<string[]>>;
  onStateChange?: (states: string[]) => void;
}

const ESTADOS_BRASILEIROS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
  // "Nacional" sempre no final:
  'Nacional'
];

export const StateSelector: React.FC<StateSelectorProps> = ({
  form,
  selectedStates,
  setSelectedStates,
  onStateChange
}) => {
  // Sincroniza com o formulário quando o componente é montado
  useEffect(() => {
    if (form) {
      const formLocalidades = form.getValues('localidades');
      if (formLocalidades && Array.isArray(formLocalidades)) {
        if (setSelectedStates) {
          setSelectedStates(formLocalidades);
        }
        if (onStateChange) {
          onStateChange(formLocalidades);
        }
      }
    }
    // eslint-disable-next-line
  }, [form, setSelectedStates, onStateChange]);

  const handleStateSelection = (estado: string) => {
    let newStates: string[] = [];

    if (estado === 'Nacional') {
      // Selecionando ou desselecionando "Nacional"
      if (selectedStates.includes('Nacional')) {
        newStates = [];
      } else {
        newStates = ['Nacional'];
      }
    } else {
      // Selecionando estados comuns
      if (selectedStates.includes(estado)) {
        newStates = selectedStates.filter(s => s !== estado && s !== 'Nacional');
      } else {
        newStates = selectedStates.filter(s => s !== 'Nacional'); // nunca pode ter Nacional + estado
        newStates = [...newStates, estado];
      }
    }

    // Atualiza o estado local
    if (setSelectedStates) setSelectedStates(newStates);
    // Atualiza o formulário diretamente
    if (form) {
      form.setValue('localidades', newStates, { shouldDirty: true, shouldValidate: true });
    }
    // Chama o callback externo, se fornecido
    if (onStateChange) onStateChange(newStates);
  };

  return (
    <FormItem>
      <FormLabel>Localidade <span className="text-red-500">*</span></FormLabel>
      <div className="flex flex-wrap gap-2">
        {selectedStates.map(estado => (
          <div key={estado} className="bg-secondary text-secondary-foreground px-2 py-1 rounded-md text-sm">
            {estado}
          </div>
        ))}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <MapPin className="h-4 w-4" />
              {selectedStates.length > 0 ? "Editar Estados" : "Adicionar Estados"}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="max-w-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle>Selecione os Estados</AlertDialogTitle>
              <AlertDialogDescription>
                <div className="grid grid-cols-3 gap-4 mt-4">
                  {ESTADOS_BRASILEIROS.map((estado, idx) => (
                    <div key={estado} className="flex items-center space-x-2">
                      <Checkbox
                        id={estado}
                        checked={selectedStates.includes(estado)}
                        onCheckedChange={() => handleStateSelection(estado)}
                        disabled={estado === 'Nacional'
                          ? selectedStates.length > 0 && !selectedStates.includes('Nacional')
                          : selectedStates.includes('Nacional')}
                      />
                      <label 
                        htmlFor={estado} 
                        className={`text-sm font-medium leading-none cursor-pointer ${estado === 'Nacional' ? "font-semibold text-blue-700" : ''}`}
                      >
                        {estado}
                      </label>
                    </div>
                  ))}
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  A opção Nacional é exclusiva. Não pode ser selecionada junto a outros estados.
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Fechar</AlertDialogCancel>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </FormItem>
  );
};

