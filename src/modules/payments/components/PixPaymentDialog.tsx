import { useEffect, useRef, useState } from 'react';
import { Check, Copy, ExternalLink, Loader2, QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { paymentService } from '../services/paymentService';
import type { CreateCheckoutResponse } from '../domain/types';

interface PixPaymentDialogProps {
  checkout: CreateCheckoutResponse | null;
  onOpenChange: (open: boolean) => void;
  onPaymentApproved: () => void;
}

export function PixPaymentDialog({ checkout, onOpenChange, onPaymentApproved }: PixPaymentDialogProps) {
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState<'checking' | 'pending' | 'approved' | 'failed'>('checking');
  const notifiedRef = useRef(false);
  const onApprovedRef = useRef(onPaymentApproved);
  onApprovedRef.current = onPaymentApproved;

  useEffect(() => {
    if (!checkout?.session_id) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const poll = async () => {
      try {
        const order = await paymentService.waitForPayment(checkout.order_id, 1, 0);
        if (stopped) return;
        if (order?.status === 'approved') {
          setStatus('approved');
          if (!notifiedRef.current) {
            notifiedRef.current = true;
            onApprovedRef.current();
          }
          return;
        }
        if (['rejected', 'failed', 'cancelled', 'canceled', 'refunded', 'charged_back', 'creation_failed'].includes(order?.status ?? '')) {
          setStatus('failed');
          return;
        }
        setStatus('pending');
      } catch {
        if (stopped) return;
        setStatus('pending');
      }
      if (!stopped) timer = setTimeout(poll, 5000);
    };

    setStatus('checking');
    void poll();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [checkout?.session_id]);

  useEffect(() => {
    if (!checkout) {
      setCopied(false);
      setStatus('checking');
      notifiedRef.current = false;
    }
  }, [checkout]);

  const copyPixCode = async () => {
    if (!checkout?.qr_code) return;
    try {
      await navigator.clipboard.writeText(checkout.qr_code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Dialog open={!!checkout} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><QrCode className="h-5 w-5" /> Pague com Pix</DialogTitle>
          <DialogDescription>Escaneie o QR Code no aplicativo do seu banco ou copie o código Pix.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {checkout?.qr_code_base64 ? (
            <div className="flex justify-center rounded-lg border bg-white p-4">
              <img className="h-56 w-56 object-contain" src={`data:image/png;base64,${checkout.qr_code_base64}`} alt="QR Code para pagamento Pix" />
            </div>
          ) : checkout?.ticket_url ? (
            <Button asChild className="w-full">
              <a href={checkout.ticket_url} target="_blank" rel="noreferrer">Abrir QR Code e instruções <ExternalLink className="ml-2 h-4 w-4" /></a>
            </Button>
          ) : null}

          {checkout?.qr_code && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Pix Copia e Cola</p>
              <div className="break-all rounded-md border bg-muted p-3 text-xs leading-relaxed">{checkout.qr_code}</div>
              <Button className="w-full" variant="outline" onClick={copyPixCode}>
                {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                {copied ? 'Código copiado' : 'Copiar código Pix'}
              </Button>
            </div>
          )}

          <div className="flex items-center gap-2 rounded-md bg-muted p-3 text-sm" aria-live="polite">
            {status === 'approved' ? <Check className="h-4 w-4 text-green-600" /> : status === 'failed' ? null : <Loader2 className="h-4 w-4 animate-spin" />}
            <span>
              {status === 'approved' ? 'Pagamento confirmado. Seu plano está ativo.' :
                status === 'failed' ? 'Este pagamento não foi concluído. Você pode tentar novamente.' :
                  status === 'checking' ? 'Verificando o status do pagamento…' : 'Aguardando confirmação do Mercado Pago…'}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">O acesso é liberado automaticamente após a confirmação do pagamento.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
