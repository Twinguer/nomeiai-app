import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Star, Loader2, Crown, ChevronDown, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Footer from '@/components/Footer';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { logError, logWarn } from '@/utils/secureLogger';
import { trackConversion } from '@/lib/analytics';
import { useIsActiveCoach, isActiveCoachSubscription } from '@/modules/coach';
import { useSubscription } from '../hooks/useSubscription';
import { paymentService } from '../services/paymentService';
import { LaunchPromoBanner } from '../components/LaunchPromoBanner';
import { LAUNCH_PROMO_COPY } from '../domain/launchPromo';
import {
  PRO_PLAN_CATALOG,
  PLAN_LEVELS,
  calculateDiscountedPrice,
  formatPlanPrice,
  formatDiscountLabel,
} from '../domain/planCatalog';

const PlanosPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    subscription: proSubscription,
    isPro,
    isFree,
    isLaunchPromo,
    launchPromoActive,
    refetch,
    validateDiscountVoucher,
    applyVoucher,
  } = useSubscription();

  const { subscription: coachSubscription } = useIsActiveCoach({ enabled: !!user });

  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [voucherCode, setVoucherCode] = useState('');
  const [appliedDiscountVoucher, setAppliedDiscountVoucher] = useState<{
    code: string;
    discountType: 'percentage' | 'fixed';
    discountValue: number;
  } | null>(null);
  const [validatingVoucher, setValidatingVoucher] = useState(false);
  const [voucherDialogOpen, setVoucherDialogOpen] = useState(false);
  const [subscriptionVoucherCode, setSubscriptionVoucherCode] = useState('');
  const [applyingSubscriptionVoucher, setApplyingSubscriptionVoucher] = useState(false);

  useEffect(() => {
    const status = searchParams.get('status');
    const plan = searchParams.get('plan');

    if (status === 'success' && plan) {
      const verifyAndActivate = async () => {
        try {
          const result = await paymentService.verifySubscription();

          if (result.success) {
            trackConversion('purchase', { value: 1.0, currency: 'BRL' });
            toast({
              title: 'Pagamento realizado com sucesso!',
              description: 'Seu plano foi ativado. Bem-vindo ao premium!',
            });
          } else {
            logWarn('Assinatura não encontrada ainda, aguardando webhook', {}, 'PAYMENT');
            toast({
              title: 'Pagamento realizado!',
              description: 'Estamos processando sua assinatura. Você receberá acesso em instantes.',
            });
          }

          await refetch();
        } catch (error) {
          logError('Erro ao verificar assinatura', error, 'PAYMENT');
          await refetch();
        }
      };

      verifyAndActivate();
    } else if (status === 'canceled') {
      toast({
        title: 'Pagamento cancelado',
        description: 'Você pode tentar novamente quando quiser.',
        variant: 'destructive',
      });
      navigate('/planos', { replace: true });
    }

    if (status === 'approved' && plan) {
      toast({
        title: 'Pagamento aprovado!',
        description: 'Seu plano foi ativado com sucesso. Bem-vindo ao premium!',
      });
      refetch();
      navigate('/planos', { replace: true });
    } else if (status === 'pending' && plan) {
      toast({
        title: 'Pagamento pendente',
        description: 'Estamos processando seu pagamento. Você receberá uma confirmação em breve.',
      });
      refetch();
      navigate('/planos', { replace: true });
    } else if (status === 'rejected' && plan) {
      toast({
        title: 'Pagamento não aprovado',
        description: 'Não foi possível processar seu pagamento. Verifique os dados e tente novamente.',
        variant: 'destructive',
      });
      navigate('/planos', { replace: true });
    }
  }, [searchParams, navigate, refetch]);

  useEffect(() => {
    const payment = searchParams.get('payment');
    const orderId = searchParams.get('order_id');
    if (payment === 'cancelled') {
      toast({ title: 'Pagamento cancelado', description: 'Você pode tentar novamente quando quiser.' });
      navigate('/planos', { replace: true });
      return;
    }
    if (payment !== 'return' || !orderId) return;

    toast({ title: 'Aguardando confirmação do Pix', description: 'O plano será liberado após a confirmação do Mercado Pago.' });
    const confirmPayment = async () => {
      try {
        const order = await paymentService.waitForPayment(orderId);
        await refetch();
        if (order?.status === 'approved') {
          trackConversion('purchase', { value: Number(order.amount), currency: 'BRL' });
          toast({ title: 'Pix confirmado!', description: 'Seu plano já está ativo.' });
        } else if (order?.status === 'rejected' || order?.status === 'cancelled') {
          toast({ title: 'Pagamento não aprovado', description: 'Você pode tentar novamente.', variant: 'destructive' });
        } else {
          toast({ title: 'Pagamento ainda pendente', description: 'A confirmação e a liberação do acesso são automáticas.' });
        }
      } catch (error) {
        logError('Erro ao consultar pagamento Pix', error, 'PAYMENT');
        toast({ title: 'Pix em processamento', description: 'Confira novamente em instantes; a confirmação é automática.' });
      } finally {
        navigate('/planos', { replace: true });
      }
    };
    void confirmPayment();
  }, [searchParams, navigate, refetch]);

  const handleSubscribe = async (planoId: string) => {
    if (planoId === 'free') {
      toast({
        title: 'Você já está no plano gratuito',
        description: 'Escolha o plano Pro para desbloquear todos os recursos',
      });
      return;
    }

    if (planoId === 'pro' && launchPromoActive && !isPro) {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: LAUNCH_PROMO_COPY.toastSignupTitle,
          description: LAUNCH_PROMO_COPY.toastSignupDescription,
        });
        navigate('/auth');
        return;
      }
      await refetch();
      toast({
        title: 'Pro de lançamento',
        description: 'Seu acesso Pro já deve estar ativo. Recarregue a página se necessário.',
      });
      return;
    }

    setLoadingPlan(planoId);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        toast({
          title: 'Autenticação necessária',
          description: 'Por favor, faça login para continuar',
          variant: 'destructive',
        });
        navigate('/auth');
        return;
      }

      const checkout = await paymentService.createCheckout(
        planoId,
        appliedDiscountVoucher?.code,
        '/planos',
      );

      if (!checkout.url) {
        throw new Error('URL de checkout não disponível');
      }

      window.location.href = checkout.url;
    } catch (error: unknown) {
      logError('Erro ao processar pagamento', error, 'PAYMENT');
      toast({
        title: 'Erro ao processar pagamento',
        description: error instanceof Error ? error.message : 'Tente novamente em alguns instantes.',
        variant: 'destructive',
      });
    } finally {
      setLoadingPlan(null);
    }
  };

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

  const handleApplySubscriptionVoucher = async () => {
    if (!subscriptionVoucherCode.trim()) {
      toast({
        title: 'Código inválido',
        description: 'Digite um código de voucher válido',
        variant: 'destructive',
      });
      return;
    }

    setApplyingSubscriptionVoucher(true);
    try {
      const result = (await applyVoucher(subscriptionVoucherCode.trim().toUpperCase())) as {
        success?: boolean;
        error?: string;
        plan?: string;
        expires_at?: string;
      };

      if (result?.success) {
        toast({
          title: 'Voucher aplicado com sucesso!',
          description: `Seu plano ${result.plan === 'pro' ? 'Pro' : 'Free'} foi ativado. Expira em: ${result.expires_at ? new Date(result.expires_at).toLocaleDateString('pt-BR') : 'Sem expiração'}`,
        });
        setSubscriptionVoucherCode('');
        setVoucherDialogOpen(false);
        await refetch();
      } else {
        toast({
          title: 'Erro ao aplicar voucher',
          description: result?.error || 'Voucher inválido ou já utilizado',
          variant: 'destructive',
        });
      }
    } catch (error: unknown) {
      toast({
        title: 'Erro ao aplicar voucher',
        description: error instanceof Error ? error.message : 'Tente novamente',
        variant: 'destructive',
      });
    } finally {
      setApplyingSubscriptionVoucher(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="page-content-container">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Escolha seu plano</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Potencialize seus estudos e alcance a aprovação com o plano Pro
          </p>
          {launchPromoActive && (
            <LaunchPromoBanner className="max-w-2xl mx-auto mt-6 text-left sm:text-center" />
          )}
          {isPro && (
            <Badge className="mt-4" variant="default">
              <Crown className="w-4 h-4 mr-1" />
              {isLaunchPromo ? LAUNCH_PROMO_COPY.badgeActive : 'Você tem o plano Pro'}
            </Badge>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto mb-8">
          {PRO_PLAN_CATALOG.map((plano) => (
            <Card
              key={plano.id}
              className={`relative flex flex-col ${plano.popular ? 'border-primary shadow-lg' : ''}`}
            >
              {plano.popular && (
                <Badge className="absolute -top-2 left-1/2 transform -translate-x-1/2 bg-primary">
                  <Star className="w-3 h-3 mr-1" />
                  Recomendado
                </Badge>
              )}

              <CardHeader className="text-center pb-4">
                <CardTitle className="text-2xl">{plano.nome}</CardTitle>
                <CardDescription>{plano.descricao}</CardDescription>

                <div className="mt-4">
                  {launchPromoActive && plano.id === 'pro' ? (
                    <>
                      <div className="text-3xl font-bold text-emerald-600">Grátis</div>
                      <div className="text-sm text-muted-foreground">
                        {LAUNCH_PROMO_COPY.durationLabel}
                      </div>
                    </>
                  ) : appliedDiscountVoucher && plano.id === 'pro' ? (
                    <>
                      <div className="flex items-center justify-center gap-2">
                        <div className="text-2xl line-through text-muted-foreground">
                          R$ {formatPlanPrice(plano.preco)}
                        </div>
                        <div className="text-3xl font-bold text-green-600">
                          R$ {formatPlanPrice(calculateDiscountedPrice(plano.preco, appliedDiscountVoucher))}
                        </div>
                      </div>
                      <div className="text-sm text-green-600 font-medium mt-1">
                        {formatDiscountLabel(appliedDiscountVoucher)}
                      </div>
                      {plano.periodo !== 'Livre' && (
                        <div className="text-sm text-muted-foreground">por {plano.periodo}</div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="text-3xl font-bold">R$ {formatPlanPrice(plano.preco)}</div>
                      {plano.periodo !== 'Livre' && (
                        <div className="text-sm text-muted-foreground">por {plano.periodo}</div>
                      )}
                    </>
                  )}
                </div>
              </CardHeader>

              <CardContent className="flex flex-col flex-grow">
                <ul className="space-y-2 flex-grow">
                  {plano.features.map((feature, index) => (
                    <li key={index} className="flex items-start text-sm">
                      <Check className="w-4 h-4 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                {(() => {
                  let maxActiveLevel = 0;

                  if (isPro) {
                    maxActiveLevel = Math.max(maxActiveLevel, PLAN_LEVELS.pro);
                  }

                  if (isActiveCoachSubscription(coachSubscription)) {
                    const coachPlanId = `coach_${coachSubscription.plan_type}`;
                    maxActiveLevel = Math.max(maxActiveLevel, PLAN_LEVELS[coachPlanId] || 0);
                  }

                  const currentPlanLevel = PLAN_LEVELS[plano.id] || 0;
                  const isCurrentPlan =
                    (plano.id === 'free' && isFree && maxActiveLevel === 0) ||
                    (plano.id === 'pro' && isPro && maxActiveLevel === 1);

                  const proExpiry = proSubscription?.expires_at
                    ? new Date(proSubscription.expires_at).getTime()
                    : null;
                  const canRenewProDuringGrace = plano.id === 'pro'
                    && isPro
                    && proExpiry !== null
                    && proExpiry <= Date.now();

                  const shouldDisable =
                    (currentPlanLevel <= maxActiveLevel && !canRenewProDuringGrace) ||
                    (launchPromoActive && plano.id === 'pro' && isPro);
                  const isLoading = loadingPlan === plano.id;
                  const isLaunchProSignup = launchPromoActive && plano.id === 'pro' && !isPro;

                  return (
                    <Button
                      className="w-full mt-6"
                      variant={plano.popular ? 'default' : 'outline'}
                      onClick={() => handleSubscribe(plano.id)}
                      disabled={isLoading || shouldDisable}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Processando...
                        </>
                      ) : isCurrentPlan ? (
                        canRenewProDuringGrace
                          ? 'Renovar com Pix'
                          : isLaunchPromo && plano.id === 'pro'
                          ? LAUNCH_PROMO_COPY.badgeIncluded
                          : 'Plano Atual'
                      ) : shouldDisable ? (
                        'Plano Atual'
                      ) : isLaunchProSignup ? (
                        user ? 'Ativar Pro grátis' : 'Cadastrar grátis'
                      ) : (
                        'Assinar'
                      )}
                    </Button>
                  );
                })()}
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="max-w-4xl mx-auto mt-6 flex items-center justify-center">
          {appliedDiscountVoucher ? (
            <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
              <Check className="w-4 h-4" />
              <span>
                Cupom {appliedDiscountVoucher.code} aplicado ({formatDiscountLabel(appliedDiscountVoucher)})
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-1 text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300"
                onClick={() => setAppliedDiscountVoucher(null)}
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          ) : (
            <Dialog open={voucherDialogOpen} onOpenChange={setVoucherDialogOpen}>
              <DialogTrigger asChild>
                <button
                  type="button"
                  className="text-sm text-primary hover:text-primary/80 transition-colors flex items-center gap-1 group"
                >
                  <span>Inserir um cupom</span>
                  <ChevronDown className="w-3 h-3 transition-transform group-hover:translate-y-0.5" />
                </button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Inserir cupom ou voucher</DialogTitle>
                  <DialogDescription>
                    Aplique um cupom de desconto ou um voucher de assinatura gratuita
                  </DialogDescription>
                </DialogHeader>
                <Tabs defaultValue="discount" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="discount">Cupom de Desconto</TabsTrigger>
                    <TabsTrigger value="subscription">Voucher de Assinatura</TabsTrigger>
                  </TabsList>

                  <TabsContent value="discount" className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="voucher-code-modal">Código do cupom</Label>
                      <Input
                        id="voucher-code-modal"
                        value={voucherCode}
                        onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                        placeholder="Digite o código"
                        className="font-mono tracking-wider"
                        disabled={validatingVoucher}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            handleValidateDiscountVoucher();
                          }
                        }}
                        autoFocus
                      />
                    </div>
                    <Button
                      onClick={handleValidateDiscountVoucher}
                      disabled={validatingVoucher || !voucherCode.trim()}
                      className="w-full"
                    >
                      {validatingVoucher ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Validando...
                        </>
                      ) : (
                        'Aplicar Cupom'
                      )}
                    </Button>
                  </TabsContent>

                  <TabsContent value="subscription" className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="subscription-voucher-code">Código do voucher</Label>
                      <Input
                        id="subscription-voucher-code"
                        value={subscriptionVoucherCode}
                        onChange={(e) => setSubscriptionVoucherCode(e.target.value.toUpperCase())}
                        placeholder="Digite o código"
                        className="font-mono tracking-wider"
                        disabled={applyingSubscriptionVoucher}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            handleApplySubscriptionVoucher();
                          }
                        }}
                      />
                    </div>
                    <Button
                      onClick={handleApplySubscriptionVoucher}
                      disabled={applyingSubscriptionVoucher || !subscriptionVoucherCode.trim()}
                      className="w-full"
                    >
                      {applyingSubscriptionVoucher ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Aplicando...
                        </>
                      ) : (
                        'Aplicar Voucher'
                      )}
                    </Button>
                  </TabsContent>
                </Tabs>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default PlanosPage;
