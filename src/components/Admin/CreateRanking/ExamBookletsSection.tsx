import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, X, FileText, AlertTriangle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { devLog, sanitizeForLog } from '@/utils/productionLogger';
interface ExamBooklet {
  id?: string;
  name: string;
  display_order: number;
}
interface ExamBookletsSectionProps {
  concursoId?: string;
  onBookletsChange?: (booklets: ExamBooklet[]) => void;
  onBookletsSaved?: (saved: boolean) => void;
}
// Export saveBooklets functionality
export const useBookletsSave = (
  concursoId: string | undefined,
  booklets: ExamBooklet[],
  validateBooklets: () => string | null,
  onSuccess: (savedBooklets: ExamBooklet[]) => void,
  onError: (error: string) => void
) => {
  const saveBooklets = async () => {
    const validationError = validateBooklets();
    if (validationError) {
      onError(validationError);
      return false;
    }

    if (!concursoId) {
      onError("Salve primeiro as informações básicas do ranking antes de configurar os cadernos.");
      return false;
    }

    try {
      // Processar cadernos para JSONB
      const processedBooklets = booklets.map((booklet, index) => ({
        id: booklet.id || crypto.randomUUID(),
        name: booklet.name,
        display_order: booklet.display_order || index + 1,
        is_active: true,
        total_questions: 0
      }));

      // Atualizar a coluna exam_booklets na tabela concursos
      const { error: updateError } = await supabase
        .from('concursos')
        .update({ exam_booklets: processedBooklets })
        .eq('id', concursoId);

      if (updateError) throw updateError;

      onSuccess(processedBooklets);
      return true;
    } catch (error: any) {
      onError(error.message || "Não foi possível salvar os cadernos");
      return false;
    }
  };

  return { saveBooklets };
};

export const ExamBookletsSection: React.FC<ExamBookletsSectionProps> = ({
  concursoId,
  onBookletsChange,
  onBookletsSaved
}) => {
  const [booklets, setBooklets] = useState<ExamBooklet[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isBookletsSaved, setIsBookletsSaved] = useState(false);
  const {
    toast
  } = useToast();

  // Carregar cadernos existentes sempre que o concursoId mudar
  useEffect(() => {
    if (concursoId) {
      loadExistingBooklets();
    } else {
      // Sem concursoId: não criar caderno por padrão; deixar vazio
      setBooklets([]);
      setIsBookletsSaved(false);
      setHasUnsavedChanges(false);
      // NÃO chamar onBookletsChange([]) para não limpar estado do pai
    }
  }, [concursoId]);
  const loadExistingBooklets = async () => {
    if (!concursoId) return;
    try {
      setIsLoading(true);
      // Log removido por segurança
      const {
        data: concursoData,
        error
      } = await supabase.from('concursos').select('exam_booklets').eq('id', concursoId).single();
      if (error) {
        devLog.error('Erro ao carregar cadernos:', error);
        throw error;
      }
      
      const data = (concursoData?.exam_booklets as any[]) || [];
      // Ordenar por display_order
      const sortedData = (data as any[]).sort((a: any, b: any) => (a.display_order || 0) - (b.display_order || 0));
      
      if (sortedData && sortedData.length > 0) {
        setBooklets(sortedData);
        setHasUnsavedChanges(false);
        setIsBookletsSaved(true);
        onBookletsChange?.(sortedData);
        onBookletsSaved?.(true);
      } else {
        // Sem cadernos salvos: manter lista vazia; usuário deve adicionar manualmente
        setBooklets([]);
        setIsBookletsSaved(false);
        setHasUnsavedChanges(false);
        // NÃO chamar onBookletsChange([]) para não limpar estado do pai
        onBookletsSaved?.(false);
      }
    } catch (error) {
      devLog.error('Erro ao carregar cadernos:', error);
      toast({
        title: "Erro ao carregar cadernos",
        description: "Não foi possível carregar os cadernos existentes",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };
  const addBooklet = () => {
    if (booklets.length >= 10) {
      toast({
        title: "Limite atingido",
        description: "Máximo de 10 cadernos permitidos por concurso",
        variant: "destructive"
      });
      return;
    }
    const newBooklet: ExamBooklet = {
      name: '',
      display_order: booklets.length + 1
    };
    const updatedBooklets = [...booklets, newBooklet];
    setBooklets(updatedBooklets);
    setHasUnsavedChanges(true);
    setIsBookletsSaved(false);
    onBookletsChange?.(updatedBooklets);
    onBookletsSaved?.(false);
  };
  const removeBooklet = (index: number) => {
    const updatedBooklets = booklets.filter((_, i) => i !== index).map((booklet, i) => ({
      ...booklet,
      display_order: i + 1
    }));
    setBooklets(updatedBooklets);
    setHasUnsavedChanges(true);
    setIsBookletsSaved(false);
    onBookletsChange?.(updatedBooklets);
    onBookletsSaved?.(false);
  };
  const updateBookletName = (index: number, name: string) => {
    const upperName = name.toUpperCase();
    const updatedBooklets = booklets.map((booklet, i) => i === index ? {
      ...booklet,
      name: upperName
    } : booklet);
    setBooklets(updatedBooklets);
    setHasUnsavedChanges(true);
    setIsBookletsSaved(false);
    onBookletsChange?.(updatedBooklets);
    onBookletsSaved?.(false);
  };
  const validateBooklets = () => {
    // Debug logs removed for security
    
    if (booklets.length === 0) {
      // Debug logs removed for security
      return "Adicione pelo menos um caderno de prova";
    }

    // Verificar nomes únicos e não vazios
    const names = booklets.map(b => b.name.trim()).filter(n => n);
    const uniqueNames = new Set(names);
    
    // Debug logs removed for security
    
    if (names.length !== booklets.length) {
      // Debug logs removed for security
      return "Todos os cadernos devem ter um nome preenchido";
    }
    if (names.length !== uniqueNames.size) {
      // Debug logs removed for security
      return "Nomes dos cadernos devem ser únicos";
    }
    
    // Debug logs removed for security
    return null;
  };
  // Export this function to be callable from parent components
  const saveBooklets = async () => {
    const validationError = validateBooklets();
    if (validationError) {
      toast({
        title: "Erro de validação",
        description: validationError,
        variant: "destructive"
      });
      return false;
    }

    // Log removido por segurança

    // Se não há concursoId ainda, mostrar aviso ao usuário
    if (!concursoId) {
      // Log removido por segurança
      toast({
        title: "Atenção",
        description: "Salve primeiro as informações básicas do ranking antes de configurar os cadernos.",
        variant: "destructive"
      });
      return false;
    }
    try {
      setIsSaving(true);
      // Log removido por segurança

      // Processar cadernos para JSONB
      const processedBooklets = booklets.map((booklet, index) => ({
        id: booklet.id || crypto.randomUUID(),
        name: booklet.name,
        display_order: booklet.display_order || index + 1,
        is_active: true,
        total_questions: 0
      }));

      // Atualizar a coluna exam_booklets na tabela concursos
      const { error: updateError } = await supabase
        .from('concursos')
        .update({ exam_booklets: processedBooklets })
        .eq('id', concursoId);

      if (updateError) {
        devLog.error('Erro ao atualizar cadernos:', updateError);
        throw updateError;
      }

      const savedBooklets = processedBooklets;
      // Debug logs removed for security
      setBooklets(savedBooklets);
      setHasUnsavedChanges(false);
      setIsBookletsSaved(true);
      onBookletsChange?.(savedBooklets);
      onBookletsSaved?.(true);
      toast({
        title: "Cadernos salvos",
        description: `${savedBooklets.length} caderno(s) configurado(s) com sucesso`
      });
      return true;
    } catch (error: any) {
      devLog.error('Erro ao salvar cadernos:', error);
      toast({
        title: "Erro ao salvar",
        description: error.message || "Não foi possível salvar os cadernos",
        variant: "destructive"
      });
      return false;
    } finally {
      setIsSaving(false);
    }
  };
  return <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Cadernos de Prova <span className="text-red-500">*</span>
          {isBookletsSaved && <span className="text-xs bg-success/10 text-success px-2 py-1 rounded-full">
              Salvos
            </span>}
          {hasUnsavedChanges && !isBookletsSaved && <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded-full">
              Não Salvos
            </span>}
        </CardTitle>
        
      </CardHeader>
      <CardContent className="space-y-4">
        {!isBookletsSaved}

        {booklets.length === 0 ? <div className="text-center py-6 text-muted-foreground">
            <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Nenhum caderno configurado</p>
            <p className="text-xs">Clique em "Adicionar Caderno" para começar</p>
          </div> : <div className="space-y-3">
            {booklets.map((booklet, index) => <div key={`${booklet.id || index}`} className="flex items-center gap-3 p-3 border rounded-lg">
                <div className="flex-1">
                  <Label htmlFor={`booklet-${index}`} className="text-sm">
                    Caderno {index + 1}
                  </Label>
                  <Input id={`booklet-${index}`} value={booklet.name} onChange={e => updateBookletName(index, e.target.value)} placeholder="Nome do caderno (ex: BRANCO, AZUL, A, B...)" className="mt-1" maxLength={100} />
                </div>
                {booklets.length > 1 && <Button type="button" variant="outline" size="sm" onClick={() => removeBooklet(index)} className="text-destructive hover:text-destructive/80">
                    <X className="h-4 w-4" />
                  </Button>}
              </div>)}
          </div>}

        <div className="flex justify-start items-center pt-4 border-t">
          <Button type="button" variant="outline" onClick={addBooklet} disabled={booklets.length >= 10 || isSaving} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Adicionar Caderno
          </Button>
        </div>

        {booklets.length > 0 && <div className="text-xs text-muted-foreground mt-2">
            
            
            
            
          </div>}
      </CardContent>
    </Card>;
};