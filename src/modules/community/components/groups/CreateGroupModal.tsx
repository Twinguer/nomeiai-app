import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus } from 'lucide-react';
import { useCreateGroup } from '../../hooks/useStudyGroups';
import { useAuth } from '@/hooks/useAuth';
import { usePlanLimits } from '@/modules/payments';
import { useNavigate } from 'react-router-dom';
import { showProRequiredToast } from '@/utils/planRestrictions';
import { useToast } from '@/components/ui/use-toast';
import type { PrivacyLevel } from '../../domain/types';

interface CreateGroupModalProps {
  onSuccess?: (groupId: string) => void;
}

export const CreateGroupModal: React.FC<CreateGroupModalProps> = ({
  onSuccess,
}) => {
  const { user } = useAuth();
  const { canCreateStudyGroup, isPro } = usePlanLimits();
  const navigate = useNavigate();
  const { toast } = useToast();
  const createGroup = useCreateGroup();
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    privacy_level: 'public' as PrivacyLevel,
    max_members: 50,
    focus_area: '',
    post_retention_days: 365,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      navigate('/auth');
      return;
    }

    // Verificar se o usuário pode criar grupos de estudo
    if (!canCreateStudyGroup) {
      toast({
        title: "Recurso Pro",
        description: "A criação de Grupos de Estudos está disponível apenas para usuários Pro.",
        variant: "destructive"
      });
      showProRequiredToast(navigate, "Criar Grupos de Estudos");
      return;
    }

    if (!formData.name.trim()) {
      return;
    }

    try {
      const newGroup = await createGroup.mutateAsync({
        ...formData,
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        focus_area: formData.focus_area.trim() || undefined,
      });
      
      if (newGroup) {
        setOpen(false);
        setFormData({
          name: '',
          description: '',
          privacy_level: 'public',
          max_members: 50,
          focus_area: '',
          post_retention_days: 365,
        });

        if (onSuccess) {
          onSuccess(newGroup.id);
        }
      }
    } catch (error: any) {
      // O erro já é tratado no hook useCreateGroup - erro silencioso
    }
  };

  // Handler para quando o modal tenta abrir
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen && !canCreateStudyGroup) {
      // Se tentar abrir e não tiver permissão, redirecionar para planos
      showProRequiredToast(navigate, "Criar Grupos de Estudos");
      return;
    }
    setOpen(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Criar Grupo
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Criar Novo Grupo de Estudos</DialogTitle>
          <DialogDescription>
            Crie um grupo para estudar junto com outros concurseiros.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome do Grupo *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ex: TJ-SP 2025"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Descreva o objetivo do grupo..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="privacy">Privacidade</Label>
              <Select
                value={formData.privacy_level}
                onValueChange={(value: PrivacyLevel) =>
                  setFormData({ ...formData, privacy_level: value })
                }
              >
                <SelectTrigger id="privacy">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">Público</SelectItem>
                  <SelectItem value="private">Privado</SelectItem>
                  <SelectItem value="invite_only">Apenas convite</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="max_members">Máx. Membros</Label>
              <Input
                id="max_members"
                type="number"
                min="1"
                max="1000"
                value={formData.max_members}
                onChange={(e) => {
                  const value = parseInt(e.target.value) || 1;
                  const clampedValue = Math.min(Math.max(value, 1), 1000); // Garantir entre 1 e 1000
                  setFormData({ ...formData, max_members: clampedValue });
                }}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="focus_area">Área de Foco (opcional)</Label>
            <Input
              id="focus_area"
              value={formData.focus_area}
              onChange={(e) => setFormData({ ...formData, focus_area: e.target.value })}
              placeholder="Ex: TJ-SP, Receita Federal..."
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={createGroup.isPending}>
              {createGroup.isPending ? 'Criando...' : 'Criar Grupo'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
