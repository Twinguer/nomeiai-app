import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Check, Download, FileText, Loader2, Pencil, Upload, X } from 'lucide-react';
import type { StudyCycleV2 } from '@/types/userStudy';
import type { CycleDocumentType } from '../hooks/useCycleDocuments';

interface CycleDocumentsPanelProps {
  selectedCycle: string;
  cycles: StudyCycleV2[];
  uploadingPDF: CycleDocumentType | null;
  editingLabel: CycleDocumentType | null;
  labelValue: string;
  onLabelValueChange: (value: string) => void;
  onStartEditingLabel: (type: CycleDocumentType) => void;
  onCancelEditingLabel: () => void;
  onSaveLabel: (type: CycleDocumentType) => void;
  onDownload: (type: CycleDocumentType) => void;
  onUpload: (type: CycleDocumentType) => void;
  onRemove: (type: CycleDocumentType) => void;
  onFileSelect: (event: React.ChangeEvent<HTMLInputElement>, type: CycleDocumentType) => void;
}

function DocumentRow({
  type,
  defaultLabel,
  inputId,
  cycle,
  uploadingPDF,
  editingLabel,
  labelValue,
  onLabelValueChange,
  onStartEditingLabel,
  onCancelEditingLabel,
  onSaveLabel,
  onDownload,
  onUpload,
  onRemove,
  onFileSelect,
  selectedCycle,
}: {
  type: CycleDocumentType;
  defaultLabel: string;
  inputId: string;
  cycle: StudyCycleV2 | undefined;
  selectedCycle: string;
} & Omit<CycleDocumentsPanelProps, 'cycles' | 'selectedCycle'>) {
  const label =
    type === 'trilha_semanal'
      ? cycle?.trilha_semanal_label || defaultLabel
      : cycle?.subjetiva_label || defaultLabel;

  const hasFile =
    Boolean((cycle as StudyCycleV2 & Record<string, string | undefined>)?.[
      type === 'trilha_semanal' ? 'trilha_semanal_file_path' : 'subjetiva_file_path'
    ]) ||
    Boolean(type === 'trilha_semanal' ? cycle?.trilha_semanal_pdf_url : cycle?.subjetiva_pdf_url);

  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <div className="flex items-center gap-1.5 flex-1 min-w-0">
        <FileText className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
        {editingLabel === type ? (
          <div className="flex items-center gap-1 flex-1 min-w-0">
            <Input
              value={labelValue}
              onChange={(e) => {
                const val = e.target.value;
                if (val.length <= 20) onLabelValueChange(val);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onSaveLabel(type);
                else if (e.key === 'Escape') onCancelEditingLabel();
              }}
              className="h-6 px-2 text-xs flex-1 min-w-0"
              autoFocus
              maxLength={20}
            />
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => onSaveLabel(type)} title="Salvar">
              <Check className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onCancelEditingLabel} title="Cancelar">
              <X className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-1 flex-1 min-w-0 group">
            <span className="font-medium truncate">{label}</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => onStartEditingLabel(type)}
              title="Editar nome"
            >
              <Pencil className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        {hasFile ? (
          <>
            <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => onDownload(type)}>
              <Download className="h-3 w-3 mr-1" />
              Download
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => onUpload(type)}
              disabled={uploadingPDF === type}
              title="Substituir PDF"
            >
              {uploadingPDF === type ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
              onClick={() => onRemove(type)}
              title="Remover PDF"
            >
              <X className="h-3 w-3" />
            </Button>
          </>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => onUpload(type)}
            disabled={uploadingPDF === type}
          >
            {uploadingPDF === type ? (
              <>
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Upload className="h-3 w-3 mr-1" />
                Enviar
              </>
            )}
          </Button>
        )}
      </div>
      <input
        id={inputId}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,application/pdf,image/jpeg,image/png,image/gif,image/webp"
        onChange={(e) => onFileSelect(e, type)}
        className="hidden"
        disabled={!selectedCycle || uploadingPDF === type}
      />
    </div>
  );
}

export function CycleDocumentsPanel({
  selectedCycle,
  cycles,
  ...handlers
}: CycleDocumentsPanelProps) {
  const cycle = cycles.find((c) => c.id === selectedCycle);

  return (
    <div className="border-t border-border pt-2 space-y-1.5">
      <DocumentRow
        type="trilha_semanal"
        defaultLabel="Trilha Semanal"
        inputId="trilha-semanal-upload"
        cycle={cycle}
        selectedCycle={selectedCycle}
        {...handlers}
      />
      <DocumentRow
        type="subjetiva"
        defaultLabel="Subjetiva"
        inputId="subjetiva-upload"
        cycle={cycle}
        selectedCycle={selectedCycle}
        {...handlers}
      />
    </div>
  );
}
