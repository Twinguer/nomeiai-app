import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  paymentService,
  useSubscription,
  isLaunchProPromoActive,
  LAUNCH_PROMO_COPY,
  DiscountCouponSection,
  useDiscountVoucherValidation,
  PLAN_LEVELS,
  calculateDiscountedPrice,
  formatDiscountLabel,
  formatPlanPrice,
} from '@/modules/payments';
import { Check, ArrowLeft, Loader2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useCoachSubscription } from '@/modules/coach';
import { isActiveCoachSubscription } from '@/modules/coach/hooks/useIsActiveCoach';
import { logError, logWarn } from '@/utils/secureLogger';
import { PixPaymentDialog } from '@/modules/payments/components/PixPaymentDialog';
import type { CreateCheckoutResponse } from '@/modules/payments/domain/types';

const CoachSubscriptionPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { validateDiscountVoucher } = useSubscription();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [pixCheckout, setPixCheckout] = useState<CreateCheckoutResponse | null>(null);
  const {
    voucherCode,
    setVoucherCode,
    appliedDiscountVoucher,
    setAppliedDiscountVoucher,
    validatingVoucher,
    voucherDialogOpen,
    setVoucherDialogOpen,
    handleValidateDiscountVoucher,
  } = useDiscountVoucherValidation(validateDiscountVoucher);

  const {
    subscription: activeSubscription,
    isLoadingSubscription,
  } = useCoachSubscription({ fetchCanInvite: false });

  // Buscar assinatura Pro para verificar hierarquia de planos
  const { isPro } = useSubscription();

  // Retorno legado do Stripe; novas compras aceitam Pix e cartão, com o webhook como fonte de verdade.
  useEffect(() => {
    const status = searchParams.get("status");
    const plan = searchParams.get("plan");
    
    if (status === "success" && plan) {
      // Verificar e ativar assinatura imediatamente no Stripe
      const verifyAndActivate = async () => {
        try {
          const result = await paymentService.verifySubscription();
          
          if (result.success) {
            // Invalidar todas as queries relacionadas à assinatura Coach para atualizar o estado
            await queryClient.invalidateQueries({ queryKey: ['coach-subscription', user?.id] });
            await queryClient.invalidateQueries({ queryKey: ['coach-subscription-menu', user?.id] });
            await queryClient.invalidateQueries({ queryKey: ['coach-subscription-landing', user?.id] });
            await queryClient.invalidateQueries({ queryKey: ['coach-can-invite', user?.id] });
            await queryClient.invalidateQueries({ queryKey: ['community-users'] });
            
            // Redirecionar para dashboard do Coach
            navigate('/coach/dashboard', { replace: true });
          } else {
            logWarn("Assinatura Coach não encontrada ainda, aguardando webhook", {}, "PAYMENT");
            
            // Invalidar queries mesmo se não encontrou ainda (pode ter sido criada pelo webhook)
            await queryClient.invalidateQueries({ queryKey: ['coach-subscription', user?.id] });
            await queryClient.invalidateQueries({ queryKey: ['coach-subscription-menu', user?.id] });
            await queryClient.invalidateQueries({ queryKey: ['coach-subscription-landing', user?.id] });
            await queryClient.invalidateQueries({ queryKey: ['coach-can-invite', user?.id] });
            await queryClient.invalidateQueries({ queryKey: ['community-users'] });
            
            // Redirecionar para dashboard do Coach
            navigate('/coach/dashboard', { replace: true });
          }
        } catch (error) {
          logError("Erro ao verificar assinatura Coach", error, "PAYMENT");
          
          // Invalidar queries mesmo em caso de erro (webhook pode ter processado)
          await queryClient.invalidateQueries({ queryKey: ['coach-subscription', user?.id] });
          await queryClient.invalidateQueries({ queryKey: ['coach-subscription-menu', user?.id] });
          await queryClient.invalidateQueries({ queryKey: ['coach-subscription-landing', user?.id] });
          await queryClient.invalidateQueries({ queryKey: ['coach-can-invite', user?.id] });
          await queryClient.invalidateQueries({ queryKey: ['community-users'] });
          
          // Redirecionar para dashboard do Coach mesmo com erro
          navigate('/coach/dashboard', { replace: true });
        }
      };
      
      verifyAndActivate();
    } else if (status === "canceled") {
      toast({
        title: "Pagamento cancelado",
        description: "Você pode tentar novamente quando quiser.",
        variant: "destructive"
      });
      navigate("/coach/subscription", { replace: true });
    }
  }, [searchParams, navigate, toast]);

  useEffect(() => {
    const payment = searchParams.get('payment');
    const orderId = searchParams.get('order_id');
    if (payment === 'cancelled') {
      toast({ title: 'Pagamento cancelado', description: 'Você pode tentar novamente quando quiser.' });
      navigate('/coach/subscription', { replace: true });
      return;
    }
    if (payment !== 'return' || !orderId) return;

    toast({ title: 'Aguardando confirmação do pagamento', description: 'O plano será liberado após a confirmação do Mercado Pago.' });
    const confirmPayment = async () => {
      try {
        const order = await paymentService.waitForPayment(orderId);
        await queryClient.invalidateQueries({ queryKey: ['coach-subscription', user?.id] });
        await queryClient.invalidateQueries({ queryKey: ['coach-subscription-menu', user?.id] });
        await queryClient.invalidateQueries({ queryKey: ['coach-subscription-landing', user?.id] });
        await queryClient.invalidateQueries({ queryKey: ['coach-can-invite', user?.id] });
        await queryClient.invalidateQueries({ queryKey: ['community-users'] });
        if (order?.status === 'approved') {
          toast({ title: 'Pagamento confirmado!', description: 'Seu plano Coach já está ativo.' });
          navigate('/coach/dashboard', { replace: true });
        } else if (['rejected', 'failed', 'cancelled', 'canceled'].includes(order?.status ?? '')) {
          toast({ title: 'Pagamento não aprovado', description: 'Você pode tentar novamente.', variant: 'destructive' });
          navigate('/coach/subscription', { replace: true });
        } else {
          toast({ title: 'Pagamento ainda pendente', description: 'A confirmação e a liberação do acesso são automáticas.' });
          navigate('/coach/subscription', { replace: true });
        }
      } catch (error) {
        logError('Erro ao consultar pagamento Coach', error, 'PAYMENT');
        toast({ title: 'Pagamento em processamento', description: 'Confira novamente em instantes; a confirmação é automática.' });
        navigate('/coach/subscription', { replace: true });
      }
    };
    void confirmPayment();
  }, [searchParams, navigate, toast, queryClient, user?.id]);

  const handleSubscribe = async (paymentMethod: 'pix' | 'card' = 'pix') => {
    if (!user?.id) {
      toast({
        title: "Autenticação necessária",
        description: "Por favor, faça login para continuar",
        variant: "destructive"
      });
      navigate("/auth");
      return;
    }

    const planId = 'coach_starter';
    setLoadingPlan(`${planId}:${paymentMethod}`);
    try {
      const checkout = await paymentService.createCheckout(
        planId,
        appliedDiscountVoucher?.code,
        '/coach/subscription',
        paymentMethod,
      );

      if (checkout.method === 'pix') {
        setPixCheckout(checkout);
        return;
      }
      if (!checkout.url) {
        throw new Error("URL de checkout não disponível");
      }

      window.location.href = checkout.url;

    } catch (error: any) {
      logError("Erro ao processar pagamento Coach", error, "PAYMENT");
      toast({
        title: "Erro ao processar pagamento",
        description: error.message || "Tente novamente em alguns instantes.",
        variant: "destructive"
      });
    } finally {
      setLoadingPlan(null);
    }
  };

  const plans = [
    {
      name: 'Coach',
      price: 49.90,
      max_students: 5,
      popular: true,
      planType: 'starter' as const,
      features: [
        'Pagamento mensal por Pix ou cartão, com renovação manual',
        '5 dias de tolerância após o vencimento',
        'Até 5 alunos',
        'Acesso a todos os rankings',
        'Pode criar rankings',
        'Edições ilimitadas nos cartões de resposta',
        'Criação de grupos e ciclos de estudos',
        'Tarefas e estatísticas dos alunos',
        'Sem propaganda',
      ],
    },
  ];
  return (
    <div className="container mx-auto p-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" size="icon" onClick={() => navigate('/coach/dashboard')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-4xl font-bold">Escolha seu Plano</h1>
          <p className="text-muted-foreground mt-2">
            Selecione o plano ideal para sua equipe de alunos
          </p>
          {isLaunchProPromoActive() && (
            <p className="text-sm text-muted-foreground mt-3 max-w-xl">
              {LAUNCH_PROMO_COPY.coachNote}{' '}
              Preparadores podem solicitar acesso beta via{' '}
              <a href="mailto:contato@nomeiai.com.br" className="text-primary underline-offset-4 hover:underline">
                contato@nomeiai.com.br
              </a>
              .
            </p>
          )}
        </div>
      </div>

      {/* Planos */}
      <div className="grid md:grid-cols-1 gap-6 max-w-xl mx-auto">
        {plans.map((plan) => (
          <Card 
            key={plan.name} 
            className={`flex flex-col ${plan.popular ? 'border-primary border-2 relative' : ''}`}
          >
            {plan.popular && (
              <Badge className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
                Mais Popular
              </Badge>
            )}
            
            <CardHeader>
              <CardTitle className="text-2xl">{plan.name}</CardTitle>
              <div className="mt-4">
                {appliedDiscountVoucher ? (() => {
                  const finalPrice = calculateDiscountedPrice(plan.price, appliedDiscountVoucher);
                  return (
                    <>
                      <div className="flex items-center justify-center gap-2">
                        <div className="text-2xl line-through text-muted-foreground">
                          R$ {formatPlanPrice(plan.price)}
                        </div>
                        <div className="text-3xl font-bold text-green-600">
                          R$ {formatPlanPrice(finalPrice)}
                        </div>
                      </div>
                      <div className="text-sm text-green-600 font-medium mt-1">
                        {formatDiscountLabel(appliedDiscountVoucher)}
                      </div>
                      <div className="text-sm text-muted-foreground">/mês</div>
                    </>
                  );
                })() : (
                  <>
                    <span className="text-4xl font-bold">R$ {formatPlanPrice(plan.price)}</span>
                    <span className="text-muted-foreground">/mês</span>
                  </>
                )}
              </div>
            </CardHeader>
            
            <CardContent className="flex flex-col flex-grow space-y-6">
              <div>
                <p className="text-sm text-muted-foreground">
                  Até {plan.max_students} alunos
                </p>
              </div>

              <ul className="space-y-3 flex-grow">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>

              {(() => {
                const planType = plan.planType;
                const planId = `coach_${planType}`;
                const currentPlanLevel = PLAN_LEVELS[planId] || 0;

                let maxActiveLevel = 0;

                if (isPro) {
                  maxActiveLevel = Math.max(maxActiveLevel, PLAN_LEVELS.pro);
                }

                if (isActiveCoachSubscription(activeSubscription)) {
                  const activeCoachPlanId = `coach_${activeSubscription.plan_type}`;
                  maxActiveLevel = Math.max(maxActiveLevel, PLAN_LEVELS[activeCoachPlanId] || 0);
                }

                const isCurrentPlan = activeSubscription?.plan_type === planType 
                  && activeSubscription?.status === 'active'
                  && isActiveCoachSubscription(activeSubscription);

                const canRenewCoachDuringGrace = isCurrentPlan
                  && !!activeSubscription?.expires_at
                  && new Date(activeSubscription.expires_at).getTime() <= Date.now();
                const shouldDisable = currentPlanLevel <= maxActiveLevel && !canRenewCoachDuringGrace;
                const isLoading = loadingPlan?.startsWith(`${planId}:`) ?? false;
                
                return isCurrentPlan || shouldDisable ? (
                  <Button
                    className="w-full mt-auto"
                    variant={plan.popular ? 'default' : 'outline'}
                    onClick={() => handleSubscribe()}
                    disabled={isLoading || shouldDisable}
                  >
                    {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processando...</> :
                      isCurrentPlan ? (canRenewCoachDuringGrace ? 'Renovar plano' : 'Seu plano atual') : 'Plano Atual'}
                  </Button>
                ) : (
                  <div className="mt-auto grid grid-cols-2 gap-2">
                    <Button onClick={() => handleSubscribe('pix')} disabled={isLoading}>
                      {loadingPlan === `${planId}:pix` ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Aguarde…</> : 'Pagar com Pix'}
                    </Button>
                    <Button variant="outline" onClick={() => handleSubscribe('card')} disabled={isLoading}>
                      {loadingPlan === `${planId}:card` ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Aguarde…</> : 'Pagar com cartão'}
                    </Button>
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="max-w-5xl mx-auto mt-6 flex items-center justify-center">
        <DiscountCouponSection
          appliedDiscountVoucher={appliedDiscountVoucher}
          onClear={() => setAppliedDiscountVoucher(null)}
          voucherCode={voucherCode}
          onVoucherCodeChange={setVoucherCode}
          validatingVoucher={validatingVoucher}
          onValidate={handleValidateDiscountVoucher}
          dialogOpen={voucherDialogOpen}
          onDialogOpenChange={setVoucherDialogOpen}
          dialogDescription="Aplique um cupom de desconto no seu plano Modo Coach"
        />
      </div>

      <PixPaymentDialog
        checkout={pixCheckout}
        onOpenChange={(open) => { if (!open) setPixCheckout(null); }}
        onPaymentApproved={() => {
          void queryClient.invalidateQueries({ queryKey: ['coach-subscription', user?.id] });
          void queryClient.invalidateQueries({ queryKey: ['coach-subscription-menu', user?.id] });
          void queryClient.invalidateQueries({ queryKey: ['coach-subscription-landing', user?.id] });
          void queryClient.invalidateQueries({ queryKey: ['coach-can-invite', user?.id] });
        }}
      />

      {/* FAQ */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Perguntas Frequentes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-semibold mb-2">Como funciona o Modo Coach?</h4>
            <p className="text-sm text-muted-foreground">
              Você convida alunos para sua equipe e acompanha seus estudos, estatísticas e progresso. 
              Os alunos pagam o plano Pro da plataforma (R$ 9,90/mês) e você pode cobrar valores
              adicionais fora da plataforma.
            </p>
          </div>
          
          <div>
            <h4 className="font-semibold mb-2">Que dados você pode ver?</h4>
            <p className="text-sm text-muted-foreground">
              Você terá acesso ao módulo de estudos (horas, sessões, ciclos) e estatísticas gerais. 
              Não terá acesso a rankings, respostas de provas ou dados sensíveis.
            </p>
          </div>

          <div>
            <h4 className="font-semibold mb-2">Posso trocar de plano depois?</h4>
            <p className="text-sm text-muted-foreground">
              Sim! Você pode fazer upgrade ou downgrade a qualquer momento. As mudanças são aplicadas 
              imediatamente.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CoachSubscriptionPage;


