import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

type BroadcastMessageDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  message: string;
  onMessageChange: (value: string) => void;
  studentCount: number;
  onSend: () => void;
  isSending?: boolean;
};

export function BroadcastMessageDialog({
  open,
  onOpenChange,
  message,
  onMessageChange,
  studentCount,
  onSend,
  isSending,
}: BroadcastMessageDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Enviar Mensagem para Todos os Alunos</DialogTitle>
          <DialogDescription>
            Envie uma mensagem de até 600 caracteres que será recebida por todos os{' '}
            {studentCount} aluno(s) da sua equipe.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Textarea
              placeholder="Digite sua mensagem aqui..."
              value={message}
              onChange={(e) => onMessageChange(e.target.value)}
              maxLength={600}
              rows={6}
              className="resize-none"
            />
            <div className="flex justify-between items-center text-xs text-muted-foreground">
              <span>Máximo de 600 caracteres</span>
              <span>{message.length}/600</span>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSending}
            className="border-purple-500 text-purple-600 hover:bg-purple-50 hover:border-purple-600 dark:border-purple-400 dark:text-purple-400 dark:hover:bg-purple-900/30"
          >
            Cancelar
          </Button>
          <Button
            onClick={onSend}
            disabled={isSending || !message.trim() || studentCount === 0}
            className="bg-purple-600 hover:bg-purple-700 text-white dark:bg-purple-500 dark:hover:bg-purple-600"
          >
            {isSending ? 'Enviando...' : `Enviar para ${studentCount} aluno(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
