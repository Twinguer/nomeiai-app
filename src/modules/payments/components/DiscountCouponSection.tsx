import React, { useState } from 'react';
import { Check, X, ChevronDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import type { AppliedDiscountVoucher } from '../domain/types';
import { formatDiscountLabel } from '../domain/planCatalog';

interface DiscountCouponSectionProps {
  appliedDiscountVoucher: AppliedDiscountVoucher | null;
  onClear: () => void;
  voucherCode: string;
  onVoucherCodeChange: (code: string) => void;
  validatingVoucher: boolean;
  onValidate: () => void;
  dialogOpen: boolean;
  onDialogOpenChange: (open: boolean) => void;
  triggerLabel?: string;
  dialogTitle?: string;
  dialogDescription?: string;
}

export const DiscountCouponSection: React.FC<DiscountCouponSectionProps> = ({
  appliedDiscountVoucher,
  onClear,
  voucherCode,
  onVoucherCodeChange,
  validatingVoucher,
  onValidate,
  dialogOpen,
  onDialogOpenChange,
  triggerLabel = 'Inserir um cupom de desconto',
  dialogTitle = 'Inserir cupom de desconto',
  dialogDescription = 'Aplique um cupom de desconto no pagamento',
}) => {
  if (appliedDiscountVoucher) {
    return (
      <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
        <Check className="w-4 h-4" />
        <span>
          Cupom {appliedDiscountVoucher.code} aplicado ({formatDiscountLabel(appliedDiscountVoucher)})
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-auto p-1 text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300"
          onClick={onClear}
        >
          <X className="w-3 h-3" />
        </Button>
      </div>
    );
  }

  return (
    <Dialog open={dialogOpen} onOpenChange={onDialogOpenChange}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="text-sm text-primary hover:text-primary/80 transition-colors flex items-center gap-1 group"
        >
          <span>{triggerLabel}</span>
          <ChevronDown className="w-3 h-3 transition-transform group-hover:translate-y-0.5" />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>{dialogDescription}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="discount-voucher-code">Código do cupom</Label>
            <Input
              id="discount-voucher-code"
              value={voucherCode}
              onChange={(e) => onVoucherCodeChange(e.target.value.toUpperCase())}
              placeholder="Digite o código"
              className="font-mono tracking-wider"
              disabled={validatingVoucher}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  onValidate();
                }
              }}
              autoFocus
            />
          </div>
          <Button
            onClick={onValidate}
            disabled={validatingVoucher || !voucherCode.trim()}
            className="w-full"
          >
            {validatingVoucher ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Validando...
              </>
            ) : (
              'Aplicar cupom'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export function useDiscountVoucherValidation(
  validateDiscountVoucher: (code: string) => Promise<unknown>,
) {
  const [voucherCode, setVoucherCode] = useState('');
  const [appliedDiscountVoucher, setAppliedDiscountVoucher] =
    useState<AppliedDiscountVoucher | null>(null);
  const [validatingVoucher, setValidatingVoucher] = useState(false);
  const [voucherDialogOpen, setVoucherDialogOpen] = useState(false);

  const handleValidateDiscountVoucher = async () => {
    if (!voucherCode.trim()) {
      toast({
        title: 'Código inválido',
        description: 'Digite um código de cupom válido',
        variant: 'destructive',
      });
      return;
    }

    setValidatingVoucher(true);
    try {
      const result = (await validateDiscountVoucher(voucherCode)) as {
        valid?: boolean;
        discount_type?: 'percentage' | 'fixed';
        discount_value?: number;
        error?: string;
      };

      if (result?.valid) {
        setAppliedDiscountVoucher({
          code: voucherCode.trim().toUpperCase(),
          discountType: result.discount_type || 'percentage',
          discountValue: parseFloat(result.discount_value?.toString() || '0'),
        });

        const discountText =
          result.discount_type === 'percentage'
            ? `${result.discount_value}%`
            : `R$ ${result.discount_value?.toFixed(2)}`;

        toast({
          title: 'Cupom aplicado!',
          description: `Desconto de ${discountText} será aplicado no pagamento`,
        });
        setVoucherCode('');
        setVoucherDialogOpen(false);
      } else {
        toast({
          title: 'Cupom inválido',
          description: result?.error || 'Cupom de desconto inválido ou expirado',
          variant: 'destructive',
        });
      }
    } catch (error: unknown) {
      toast({
        title: 'Erro ao validar cupom',
        description: error instanceof Error ? error.message : 'Tente novamente',
        variant: 'destructive',
      });
    } finally {
      setValidatingVoucher(false);
    }
  };

  return {
    voucherCode,
    setVoucherCode,
    appliedDiscountVoucher,
    setAppliedDiscountVoucher,
    validatingVoucher,
    voucherDialogOpen,
    setVoucherDialogOpen,
    handleValidateDiscountVoucher,
  };
}
