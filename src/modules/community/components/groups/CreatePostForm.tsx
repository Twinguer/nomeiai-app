import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Send, Image as ImageIcon, FileText, X, Loader2 } from 'lucide-react';
import { useCreatePost } from '../../hooks/useGroupPosts';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { logError } from '@/utils/secureLogger';
import { getAvatarUrl } from '@/utils/avatarUtils';
import { validateFileUploadSimple, formatFileSize } from '@/utils/fileUploadValidator';
import { FILE_UPLOAD_LIMITS } from '@/config/fileUploadLimits';
import { validateGroupContent } from '../../domain/groupContentSecurity';

interface CreatePostFormProps {
  groupId: string;
  onPostCreated?: () => void;
}

export const CreatePostForm: React.FC<CreatePostFormProps> = ({
  groupId,
  onPostCreated,
}) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const createPost = useCreatePost();
  const [content, setContent] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  const MAX_CONTENT_LENGTH = 500; // Limite de caracteres para posts

  // Buscar perfil do usuário para mostrar avatar e nome
  const { data: userProfile } = useQuery({
    queryKey: ['user-profile', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from('users_profiles')
        .select('name, avatar_url')
        .eq('id', user.id)
        .single();
      return data;
    },
    enabled: !!user,
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, isImage: boolean) => {
    if (!e.target.files || e.target.files.length === 0) return;

    const file = e.target.files[0];
    const uploadType = isImage ? 'POST_IMAGE' : 'POST_PDF';
    
    // Validar arquivo usando o sistema padronizado
    const validation = validateFileUploadSimple(file, uploadType, isImage);
    
    if (!validation.isValid) {
      toast({
        title: 'Arquivo inválido',
        description: validation.errors.join('. '),
        variant: 'destructive',
      });
      e.target.value = '';
      return;
    }

    setAttachments(prev => [...prev, file]);
    
    // Limpar input para permitir selecionar o mesmo arquivo novamente
    e.target.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      navigate('/auth');
      return;
    }

    const contentValidation = validateGroupContent(content, {
      allowEmpty: attachments.length > 0,
    });
    if (!contentValidation.ok) {
      toast({
        title: 'Conteúdo inválido',
        description: contentValidation.error,
        variant: 'destructive',
      });
      return;
    }

    if (!contentValidation.value && attachments.length === 0) {
      toast({
        title: 'Conteúdo vazio',
        description: 'Adicione um texto ou um arquivo para publicar.',
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);

    try {
      // Upload de anexos
      const uploadedAttachments: Array<{ url: string; type: 'image' | 'pdf'; name: string }> = [];
      
      for (const file of attachments) {
        const fileExt = file.name.split('.').pop();
        const fileName = `post-${groupId}-${user.id}-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `group-posts/${groupId}/${fileName}`;
        const isImage = file.type.startsWith('image/');

        // Upload para storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('profiles') // Usar bucket profiles (pode criar um específico depois)
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false,
            contentType: file.type,
          });

        if (uploadError) {
          throw new Error(`Erro ao fazer upload de ${file.name}: ${uploadError.message}`);
        }

        // Obter URL pública
        const { data: { publicUrl } } = supabase.storage
          .from('profiles')
          .getPublicUrl(filePath);

        uploadedAttachments.push({
          url: publicUrl,
          type: isImage ? 'image' : 'pdf',
          name: file.name,
        });
      }

      // Criar post com anexos
      await createPost.mutateAsync({
        groupId,
        content: contentValidation.value || undefined,
        attachments: uploadedAttachments.length > 0 ? uploadedAttachments : undefined,
      });

      // Limpar formulário
      setContent('');
      setAttachments([]);
      if (onPostCreated) {
        onPostCreated();
      }
    } catch (error: any) {
      logError('Erro ao criar post', error, 'STUDY_GROUPS');
      if (error?.message?.includes('upload')) {
        toast({
          title: 'Erro ao enviar arquivo',
          description: error.message,
          variant: 'destructive',
        });
      }
    } finally {
      setUploading(false);
    }
  };

  const getInitials = (name?: string) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  };

  if (!user) {
    return (
      <div className="bg-muted rounded-lg p-4 text-center text-sm text-muted-foreground">
        Faça login para criar posts no grupo.
      </div>
    );
  }

  return (
    <div className="bg-card border rounded-lg p-4">
      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Cabeçalho com avatar e nome */}
        <div className="flex items-center gap-3 mb-3">
          <Avatar className="h-10 w-10">
            {userProfile?.avatar_url ? (
              <AvatarImage src={getAvatarUrl(userProfile.avatar_url)} alt={userProfile.name || 'Usuário'} />
            ) : (
              <AvatarFallback>{getInitials(userProfile?.name)}</AvatarFallback>
            )}
          </Avatar>
          <div className="flex-1">
            <p className="text-sm font-medium">
              {userProfile?.name || 'Você'}
            </p>
          </div>
        </div>

        {/* Campo de texto */}
        <div className="space-y-1">
          <Textarea
            value={content}
            onChange={(e) => {
              const newValue = e.target.value;
              if (newValue.length <= MAX_CONTENT_LENGTH) {
                setContent(newValue);
              }
            }}
            placeholder="Metas de estudos de hoje."
            rows={3}
            maxLength={MAX_CONTENT_LENGTH}
            className="resize-none min-h-[80px] border-0 focus-visible:ring-0 focus-visible:ring-offset-0 bg-muted/50"
          />
          <div className="flex justify-end">
            <span className={`text-xs ${content.length >= MAX_CONTENT_LENGTH ? 'text-destructive' : 'text-muted-foreground'}`}>
              {content.length}/{MAX_CONTENT_LENGTH} caracteres
            </span>
          </div>
        </div>

        {/* Preview de anexos */}
        {attachments.length > 0 && (
          <div className="space-y-2">
            {attachments.map((file, index) => (
              <div
                key={index}
                className="flex items-center gap-2 p-2 bg-muted/50 rounded-md"
              >
                {file.type.startsWith('image/') ? (
                  <ImageIcon className="h-4 w-4 text-blue-600" />
                ) : (
                  <FileText className="h-4 w-4 text-red-600" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(file.size)}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeAttachment(index)}
                  className="h-6 w-6 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Ações */}
        <div className="flex items-center justify-between pt-2 border-t">
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              className="hidden"
              onChange={(e) => handleFileSelect(e, true)}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              <ImageIcon className="h-4 w-4 mr-2" />
              Foto
            </Button>
            <input
              ref={pdfInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => handleFileSelect(e, false)}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => pdfInputRef.current?.click()}
              disabled={uploading}
            >
              <FileText className="h-4 w-4 mr-2" />
              PDF
            </Button>
          </div>
          <Button
            type="submit"
            disabled={(!content.trim() && attachments.length === 0) || uploading || createPost.isPending}
            size="sm"
          >
            {uploading || createPost.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Publicando...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Publicar
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
};

