import React from 'react';
import { Loader2, ShieldAlert } from 'lucide-react';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useOpenAdminPanel } from '@/hooks/useOpenAdminPanel';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type AdminModeAccessButtonProps = {
  className?: string;
};

export function AdminModeAccessButton({ className }: AdminModeAccessButtonProps) {
  const { isAdmin, isLoading } = useAdminAuth();
  const isMobile = useIsMobile();
  const { openAdminPanel, isOpening } = useOpenAdminPanel();

  if (isLoading || !isAdmin || isMobile) {
    return null;
  }

  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      className={cn(
        'ml-2 h-7 gap-1 bg-accent px-2 text-xs text-accent-foreground hover:bg-accent/90',
        className,
      )}
      onClick={openAdminPanel}
      disabled={isOpening}
      aria-label="Abrir painel administrativo"
    >
      {isOpening ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <ShieldAlert className="h-3.5 w-3.5" />
      )}
      <span className="font-medium">Modo Admin</span>
    </Button>
  );
}
