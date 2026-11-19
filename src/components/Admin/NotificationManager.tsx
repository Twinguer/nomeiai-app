import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Send, Users, User, Globe } from 'lucide-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { devLog, sanitizeForLog } from '@/utils/productionLogger';

interface SendNotificationData {
  targetType: 'all' | 'ranking' | 'user';
  targetId?: string;
  title: string;
  message: string;
}

export const NotificationManager = () => {
  const { isAdmin } = useAdminAuth();
  const { toast } = useToast();
  const [formData, setFormData] = useState<SendNotificationData>({
    targetType: 'all',
    title: '',
    message: '',
  });

  // Buscar concursos para seleção
  const { data: concursos = [] } = useQuery({
    queryKey: ['concursos-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('concursos')
        .select('id, titulo, orgao')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
  });

  // Buscar usuários para seleção
  const { data: users = [] } = useQuery({
    queryKey: ['users-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users_profiles')
        .select('id, name')
        .order('name', { ascending: true });
      
      if (error) throw error;
      return data;
    },
    enabled: isAdmin && formData.targetType === 'user',
  });

  // Mutation para enviar notificação
  const sendNotificationMutation = useMutation({
    mutationFn: async (data: SendNotificationData) => {
      const { data: result, error } = await supabase.rpc('admin_send_notification', {
        p_target_type: data.targetType,
        p_target_id: data.targetId || null,
        p_title: data.title,
        p_message: data.message,
      });

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      toast({
        title: "Sucesso",
        description: "Notificação enviada com sucesso!",
      });
      setFormData({
        targetType: 'all',
        title: '',
        message: '',
      });
    },
    onError: (error) => {
      devLog.error('Error sending notification:', error);
      toast({
        title: "Erro",
        description: "Não foi possível enviar a notificação",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim() || !formData.message.trim()) {
      toast({
        title: "Erro",
        description: "Por favor, preencha o título e a mensagem",
        variant: "destructive",
      });
      return;
    }

    if ((formData.targetType === 'ranking' || formData.targetType === 'user') && !formData.targetId) {
      toast({
        title: "Erro",
        description: "Por favor, selecione o destino da notificação",
        variant: "destructive",
      });
      return;
    }

    sendNotificationMutation.mutate(formData);
  };

  if (!isAdmin) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-center text-muted-foreground">
            Acesso negado. Apenas administradores podem enviar notificações.
          </p>
        </CardContent>
      </Card>
    );
  }

  const getTargetIcon = () => {
    switch (formData.targetType) {
      case 'all':
        return <Globe className="h-4 w-4" />;
      case 'ranking':
        return <Users className="h-4 w-4" />;
      case 'user':
        return <User className="h-4 w-4" />;
      default:
        return <Send className="h-4 w-4" />;
    }
  };

  const getTargetLabel = () => {
    switch (formData.targetType) {
      case 'all':
        return 'Todos os usuários';
      case 'ranking':
        return 'Usuários de um ranking';
      case 'user':
        return 'Usuário específico';
      default:
        return '';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="h-5 w-5" />
          Enviar Notificações
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Tipo de destinatário */}
          <div className="space-y-2">
            <Label htmlFor="targetType">Destinatário</Label>
            <Select
              value={formData.targetType}
              onValueChange={(value: 'all' | 'ranking' | 'user') => 
                setFormData(prev => ({ ...prev, targetType: value, targetId: undefined }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo de destinatário" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    Todos os usuários
                  </div>
                </SelectItem>
                <SelectItem value="ranking">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Usuários de um ranking específico
                  </div>
                </SelectItem>
                <SelectItem value="user">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Usuário específico
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Seleção de ranking específico */}
          {formData.targetType === 'ranking' && (
            <div className="space-y-2">
              <Label htmlFor="ranking">Ranking</Label>
              <Select
                value={formData.targetId || ''}
                onValueChange={(value) => setFormData(prev => ({ ...prev, targetId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um ranking" />
                </SelectTrigger>
                <SelectContent>
                  {concursos.map((concurso) => (
                    <SelectItem key={concurso.id} value={concurso.id}>
                      {concurso.titulo} - {concurso.orgao}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Seleção de usuário específico */}
          {formData.targetType === 'user' && (
            <div className="space-y-2">
              <Label htmlFor="user">Usuário</Label>
              <Select
                value={formData.targetId || ''}
                onValueChange={(value) => setFormData(prev => ({ ...prev, targetId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um usuário" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name || 'Usuário sem nome'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Título */}
          <div className="space-y-2">
            <Label htmlFor="title">Título</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Digite o título da notificação"
              maxLength={100}
            />
          </div>

          {/* Mensagem */}
          <div className="space-y-2">
            <Label htmlFor="message">Mensagem</Label>
            <Textarea
              id="message"
              value={formData.message}
              onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
              placeholder="Digite a mensagem da notificação"
              rows={4}
              maxLength={500}
            />
          </div>

          {/* Preview */}
          <div className="border rounded-lg p-4 bg-secondary">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="text-xs">
                {getTargetIcon()}
                <span className="ml-1">{getTargetLabel()}</span>
              </Badge>
            </div>
            <h4 className="font-medium text-sm mb-1">
              {formData.title || 'Título da notificação'}
            </h4>
            <p className="text-sm text-muted-foreground">
              {formData.message || 'Mensagem da notificação aparecerá aqui...'}
            </p>
          </div>

          {/* Botão de envio */}
          <Button
            type="submit"
            disabled={sendNotificationMutation.isPending}
            className="w-full"
          >
            {sendNotificationMutation.isPending ? (
              "Enviando..."
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Enviar Notificação
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};