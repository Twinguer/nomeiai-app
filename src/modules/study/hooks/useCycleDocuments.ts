import { useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { UserStudyService } from '@/services/userStudyService';
import { validateFileUploadSimple } from '@/utils/fileUploadValidator';
import { devLog } from '@/utils/productionLogger';
import type { StudyCycleV2 } from '@/types/userStudy';

export type CycleDocumentType = 'trilha_semanal' | 'subjetiva';

interface UseCycleDocumentsOptions {
  cycles: StudyCycleV2[];
  selectedCycle: string;
  coachMode?: boolean;
  targetStudentId?: string;
  userId?: string;
  refreshCycles: () => Promise<void>;
}

export function useCycleDocuments({
  cycles,
  selectedCycle,
  coachMode,
  targetStudentId,
  userId,
  refreshCycles,
}: UseCycleDocumentsOptions) {
  const [uploadingPDF, setUploadingPDF] = useState<CycleDocumentType | null>(null);
  const [editingLabel, setEditingLabel] = useState<CycleDocumentType | null>(null);
  const [labelValue, setLabelValue] = useState('');

  const resolveTargetUserId = () => (coachMode ? targetStudentId : userId);

  const handlePDFUpload = (type: CycleDocumentType) => {
    if (!selectedCycle) {
      toast.error('Nenhum ciclo selecionado');
      return;
    }
    if (uploadingPDF === type) return;

    const inputId = type === 'trilha_semanal' ? 'trilha-semanal-upload' : 'subjetiva-upload';
    const input = document.getElementById(inputId) as HTMLInputElement | null;
    if (!input) {
      devLog.error(`Input ${inputId} não encontrado`);
      toast.error('Erro ao abrir seletor de arquivos');
      return;
    }
    if (input.disabled) {
      toast.error('Não é possível fazer upload no momento');
      return;
    }
    input.value = '';
    input.click();
  };

  const generateDocumentToken = async (
    type: CycleDocumentType,
    cycleId: string,
    filePath: string
  ): Promise<string | null> => {
    if (!userId) {
      toast.error('Erro ao identificar usuário');
      return null;
    }

    try {
      const { data: tokenHash, error } = await supabase.rpc('generate_secure_token', {
        p_entity_type: 'study_document',
        p_entity_id: userId,
        p_metadata: { filePath, cycleId, documentType: type },
        p_expires_in_minutes: 60,
      });

      if (error || !tokenHash) {
        devLog.error('Erro ao gerar token seguro:', error);
        toast.error('Erro ao gerar link seguro');
        return null;
      }
      return tokenHash;
    } catch (error: unknown) {
      devLog.error('Erro ao gerar token seguro:', error);
      toast.error('Erro ao gerar link seguro');
      return null;
    }
  };

  const migrateLegacyUrlToFilePath = async (
    type: CycleDocumentType,
    legacyUrl: string
  ): Promise<string | null> => {
    try {
      const urlPattern = /\/storage\/v1\/object\/public\/profiles\/(.+)$/;
      const match = legacyUrl.match(urlPattern);
      if (!match?.[1]) {
        toast.error('Erro ao processar URL do documento. Por favor, faça upload novamente.');
        return null;
      }

      const filePath = match[1];
      const targetUserId = resolveTargetUserId();
      if (!targetUserId) return null;

      const filePathField = type === 'trilha_semanal' ? 'trilha_semanal_file_path' : 'subjetiva_file_path';
      const urlField = type === 'trilha_semanal' ? 'trilha_semanal_pdf_url' : 'subjetiva_pdf_url';

      const updateResult = await UserStudyService.updateCycle(targetUserId, selectedCycle, {
        [filePathField]: filePath,
        [urlField]: null,
      } as Partial<StudyCycleV2>);

      if (!updateResult) {
        toast.error('Erro ao migrar documento. Tente novamente.');
        return null;
      }

      await refreshCycles();
      return filePath;
    } catch (error) {
      devLog.error('Erro ao migrar URL legada:', error);
      toast.error('Erro ao migrar documento. Por favor, faça upload novamente.');
      return null;
    }
  };

  const handleDownloadDocument = async (type: CycleDocumentType) => {
    const cycle = cycles.find((c) => c.id === selectedCycle);
    if (!cycle || !selectedCycle) {
      toast.error('Ciclo não encontrado');
      return;
    }

    const filePathField = type === 'trilha_semanal' ? 'trilha_semanal_file_path' : 'subjetiva_file_path';
    let filePath = (cycle as StudyCycleV2 & Record<string, string | undefined>)[filePathField];

    if (!filePath) {
      const legacyUrl =
        type === 'trilha_semanal' ? cycle.trilha_semanal_pdf_url : cycle.subjetiva_pdf_url;
      if (legacyUrl) {
        toast.info('Migrando documento para sistema seguro...');
        filePath = (await migrateLegacyUrlToFilePath(type, legacyUrl)) ?? undefined;
        if (!filePath) return;
        toast.success('Documento migrado com sucesso!');
      } else {
        toast.error('Documento não encontrado. Por favor, faça upload novamente.');
        return;
      }
    }

    const token = await generateDocumentToken(type, selectedCycle, filePath);
    if (!token) return;

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
      toast.error('Erro de configuração: URL ou chave do Supabase não encontrada');
      return;
    }

    try {
      const functionUrl = `${supabaseUrl}/functions/v1/serve-document?token=${token}`;
      const response = await fetch(functionUrl, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${supabaseAnonKey}`,
          apikey: supabaseAnonKey,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
        toast.error(`Erro ao baixar documento: ${errorData.error || response.statusText}`);
        return;
      }

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const fileName = filePath.split('/').pop() || `documento_${type}_${selectedCycle}.pdf`;
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
      toast.success('Download iniciado!');
    } catch (error) {
      devLog.error('Erro ao baixar documento:', error);
      toast.error('Erro ao baixar documento. Tente novamente.');
    }
  };

  const handlePDFFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>,
    type: CycleDocumentType
  ) => {
    const file = event.target.files?.[0];
    if (!file || !selectedCycle) {
      event.target.value = '';
      return;
    }

    const fileName = file.name.toLowerCase();
    const fileType = file.type.toLowerCase();
    const allowedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const allowedImageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

    const isPDF =
      fileType.includes('pdf') ||
      fileName.endsWith('.pdf') ||
      fileName.includes('.pdf');
    const isImage =
      allowedImageTypes.includes(fileType) ||
      allowedImageExtensions.some((ext) => fileName.endsWith(ext));

    if (!isPDF && !isImage) {
      toast.error('Apenas arquivos PDF ou imagens (JPG, PNG, GIF, WEBP) são permitidos.');
      event.target.value = '';
      return;
    }

    const validation = validateFileUploadSimple(file, 'STUDY_DOCUMENT', isImage);
    if (!validation.isValid) {
      toast.error(validation.errors.join('. '));
      event.target.value = '';
      return;
    }

    setUploadingPDF(type);
    const targetUserId = resolveTargetUserId();
    if (!targetUserId) {
      toast.error('Erro ao identificar usuário');
      setUploadingPDF(null);
      event.target.value = '';
      return;
    }

    try {
      const cycle = cycles.find((c) => c.id === selectedCycle);
      if (!cycle) {
        toast.error('Ciclo não encontrado');
        return;
      }

      let fileExt: string;
      if (isPDF) {
        fileExt = 'pdf';
      } else {
        const imageExt = fileName.match(/\.(jpg|jpeg|png|gif|webp)$/)?.[1] || 'jpg';
        fileExt = imageExt === 'jpeg' ? 'jpg' : imageExt;
      }

      const uploadFileName = `cycle-${selectedCycle}-${type}-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const storagePath = `study-documents/${targetUserId}/${uploadFileName}`;

      let fileToUpload: File | Blob = file;
      if (isPDF && file.type !== 'application/pdf') {
        const arrayBuffer = await file.arrayBuffer();
        const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
        fileToUpload = new File([blob], file.name.endsWith('.pdf') ? file.name : `${file.name}.pdf`, {
          type: 'application/pdf',
          lastModified: file.lastModified,
        });
      }

      const { error: uploadError } = await supabase.storage
        .from('profiles')
        .upload(storagePath, fileToUpload, { cacheControl: '3600', upsert: false });

      if (uploadError) throw uploadError;

      const filePathField = type === 'trilha_semanal' ? 'trilha_semanal_file_path' : 'subjetiva_file_path';
      const urlField = type === 'trilha_semanal' ? 'trilha_semanal_pdf_url' : 'subjetiva_pdf_url';

      await UserStudyService.updateCycle(targetUserId, selectedCycle, {
        [filePathField]: storagePath,
        [urlField]: null,
      } as Partial<StudyCycleV2>);

      await refreshCycles();
      toast.success(
        `${type === 'trilha_semanal' ? 'Trilha Semanal' : 'Subjetiva'} (${isPDF ? 'PDF' : 'imagem'}) enviada com sucesso!`
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Tente novamente';
      toast.error(`Erro ao fazer upload: ${message}`);
    } finally {
      setUploadingPDF(null);
      event.target.value = '';
    }
  };

  const handlePDFRemove = async (type: CycleDocumentType) => {
    if (!selectedCycle) {
      toast.error('Nenhum ciclo selecionado');
      return;
    }

    const targetUserId = resolveTargetUserId();
    if (!targetUserId) {
      toast.error('Erro ao identificar usuário');
      return;
    }

    const cycle = cycles.find((c) => c.id === selectedCycle);
    if (!cycle) {
      toast.error('Ciclo não encontrado');
      return;
    }

    const filePathField = type === 'trilha_semanal' ? 'trilha_semanal_file_path' : 'subjetiva_file_path';
    const filePath = (cycle as StudyCycleV2 & Record<string, string | undefined>)[filePathField];

    if (filePath) {
      try {
        await supabase.storage.from('profiles').remove([filePath]);
      } catch (error) {
        devLog.error('Erro ao remover arquivo:', error);
      }
    }

    const urlField = type === 'trilha_semanal' ? 'trilha_semanal_pdf_url' : 'subjetiva_pdf_url';
    try {
      await UserStudyService.updateCycle(targetUserId, selectedCycle, {
        [filePathField]: null,
        [urlField]: null,
      } as Partial<StudyCycleV2>);
      await refreshCycles();
      toast.success(`${type === 'trilha_semanal' ? 'Trilha Semanal' : 'Subjetiva'} removida`);
    } catch (error) {
      devLog.error('Error removing PDF:', error);
      toast.error('Erro ao remover PDF');
    }
  };

  const startEditingLabel = (type: CycleDocumentType) => {
    const cycle = cycles.find((c) => c.id === selectedCycle);
    if (!cycle) return;

    const currentLabel =
      type === 'trilha_semanal'
        ? cycle.trilha_semanal_label || 'Trilha Semanal'
        : cycle.subjetiva_label || 'Subjetiva';

    setEditingLabel(type);
    setLabelValue(currentLabel);
  };

  const cancelEditingLabel = () => {
    setEditingLabel(null);
    setLabelValue('');
  };

  const saveLabel = async (type: CycleDocumentType) => {
    if (!selectedCycle) {
      toast.error('Nenhum ciclo selecionado');
      return;
    }

    const trimmedValue = labelValue.trim();
    if (trimmedValue.length === 0) {
      toast.error('O nome não pode estar vazio');
      return;
    }
    if (trimmedValue.length > 20) {
      toast.error('O nome deve ter no máximo 20 caracteres');
      return;
    }

    const targetUserId = resolveTargetUserId();
    if (!targetUserId) {
      toast.error('Erro ao identificar usuário');
      return;
    }

    const updateField = type === 'trilha_semanal' ? 'trilha_semanal_label' : 'subjetiva_label';
    try {
      await UserStudyService.updateCycle(targetUserId, selectedCycle, {
        [updateField]: trimmedValue,
      });
      await refreshCycles();
      setEditingLabel(null);
      setLabelValue('');
      toast.success('Nome atualizado');
    } catch (error) {
      devLog.error('Error saving label:', error);
      toast.error('Erro ao salvar nome');
    }
  };

  return {
    uploadingPDF,
    editingLabel,
    labelValue,
    setLabelValue,
    handlePDFUpload,
    handlePDFFileSelect,
    handleDownloadDocument,
    handlePDFRemove,
    startEditingLabel,
    cancelEditingLabel,
    saveLabel,
  };
}
