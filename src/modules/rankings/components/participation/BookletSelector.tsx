import React from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
interface ExamBooklet {
  id: string;
  name: string;
  display_order: number;
}
interface BookletSelectorProps {
  booklets: ExamBooklet[];
  selectedBooklet: string;
  onBookletChange: (bookletId: string) => void;
  disabled?: boolean;
  required?: boolean;
}
export const BookletSelector: React.FC<BookletSelectorProps> = ({
  booklets,
  selectedBooklet,
  onBookletChange,
  disabled = false,
  required = false
}) => {
  // Não mostra o seletor se não há cadernos ou há apenas um
  if (!booklets || booklets.length === 0) {
    return null;
  }

  // Se há apenas um caderno, seleciona automaticamente
  React.useEffect(() => {
    if (booklets.length === 1 && !selectedBooklet) {
      onBookletChange(booklets[0].id);
    }
  }, [booklets, selectedBooklet, onBookletChange]);

  // Se há apenas um caderno, não mostra o seletor
  if (booklets.length === 1) {
    return <div className="space-y-2">
        <Label className="flex items-center gap-2 text-sm font-medium">
          <FileText className="h-4 w-4" />
          Caderno da Prova
        </Label>
        <div className="px-3 py-2 border rounded-md bg-muted">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <span className="font-medium break-words">{booklets[0].name}</span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Caderno único configurado para este concurso.
        </p>
      </div>;
  }
  return <div className="space-y-2">
      <Label htmlFor="booklet-select" className="flex items-center gap-2 text-sm font-medium">
        <FileText className="h-4 w-4" />
        Caderno da Prova {required && <span className="text-red-500">*</span>}
      </Label>
      
      <Select value={selectedBooklet} onValueChange={onBookletChange} disabled={disabled} required={required}>
        <SelectTrigger id="booklet-select" className={!selectedBooklet && required ? "border-red-300" : ""}>
          <SelectValue placeholder="Selecione o caderno da sua prova" />
        </SelectTrigger>
        <SelectContent>
          {booklets.map(booklet => <SelectItem key={booklet.id} value={booklet.id}>
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                <span className="font-medium">{booklet.name}</span>
              </div>
            </SelectItem>)}
        </SelectContent>
      </Select>
      
      {required && !selectedBooklet && (
        <p className="text-xs text-red-500">Por favor, selecione um caderno</p>
      )}
    </div>;
};