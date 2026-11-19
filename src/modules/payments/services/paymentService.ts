/**
 * Payment Service — checkout Pix via Mercado Pago; mantém consultas Stripe para assinaturas legadas.
 */

import { supabase } from '@/integrations/supabase/client';
import { devLog, sanitizeForLog } from '@/utils/productionLogger';
import type { CreateCheckoutResponse, PaymentOrderStatus, VerifySubscriptionResult } from '../domain/types';

async function ensureValidSession(): Promise<string> {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();

  if (sessionError) {
    devLog.error('[paymentService] Erro ao validar sessão');
    throw new Error('Erro ao validar autenticação. Por favor, faça login novamente.');
  }

  if (!session) {
    throw new Error('Usuário não autenticado. Por favor, faça login novamente.');
  }

  const now = Math.floor(Date.now() / 1000);
  const expiresAt = session.expires_at || 0;
  const timeUntilExpiry = expiresAt - now;

  if (timeUntilExpiry < 300 || expiresAt <= now) {
    try {
      const { data: { session: refreshedSession }, error: refreshError } =
        await supabase.auth.refreshSession(session);

      if (refreshError) {
        throw new Error('Sessão expirada. Por favor, faça login novamente.');
      }

      if (refreshedSession?.session?.access_token) {
        return refreshedSession.session.access_token;
      }
      throw new Error('Não foi possível atualizar a sessão. Por favor, faça login novamente.');
    } catch (refreshError: unknown) {
      const message = refreshError instanceof Error ? refreshError.message : '';
      if (message.includes('expired') || message.includes('invalid')) {
        throw new Error('Sessão expirada. Por favor, faça login novamente.');
      }
      throw new Error('Erro ao atualizar sessão. Por favor, faça login novamente.');
    }
  }

  if (!session.access_token) {
    throw new Error('Token de autenticação inválido. Por favor, faça login novamente.');
  }

  return session.access_token;
}

function handleApiError(error: { message?: string; context?: { body?: { details?: string } } }): Error {
  const errorMessage = error?.message || '';

  if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
    devLog.error('[paymentService] Erro de autenticação');
    return new Error('Erro de autenticação. Por favor, faça login novamente.');
  }

  if (errorMessage.includes('403') || errorMessage.includes('Forbidden')) {
    devLog.error('[paymentService] Acesso negado');
    return new Error('Acesso negado. Verifique suas permissões.');
  }

  if (errorMessage.includes('400') || errorMessage.includes('Bad Request')) {
    devLog.error('[paymentService] Dados inválidos');
    const errorDetails = error?.context?.body?.details || error?.message || 'Dados inválidos';
    return new Error(`Erro: ${errorDetails}`);
  }

  if (errorMessage.includes('500') || errorMessage.includes('Internal Server')) {
    devLog.error('[paymentService] Erro no servidor ao processar pagamento');
    return new Error('Erro no servidor. Tente novamente em alguns instantes.');
  }

  devLog.error('[paymentService] Erro ao processar requisição de pagamento');
  return new Error('Erro ao processar pagamento. Tente novamente.');
}

const HANDLED_ERROR_FRAGMENTS = [
  'Erro de autenticação',
  'Acesso negado',
  'Dados inválidos',
  'Erro no servidor',
  'Erro ao processar pagamento',
  'ID do plano',
  'Resposta inválida',
  'Resposta incompleta',
];

function isHandledError(error: unknown): error is Error {
  return (
    error instanceof Error &&
    HANDLED_ERROR_FRAGMENTS.some((fragment) => error.message.includes(fragment))
  );
}

export const paymentService = {
  async createCheckout(
    planId: string,
    voucherCode?: string,
    returnPath: '/planos' | '/coach/subscription' = '/planos',
  ): Promise<CreateCheckoutResponse> {
    try {
      if (!planId || typeof planId !== 'string') {
        throw new Error('ID do plano é obrigatório');
      }

      await ensureValidSession();

      devLog.log('[paymentService] Criando checkout Pix no Mercado Pago para plano:', planId);
      devLog.log('[paymentService] Voucher:', voucherCode || 'nenhum');
      const body: Record<string, string> = { planId, returnPath };
      if (voucherCode) {
        body.voucherCode = voucherCode;
      }
      devLog.log('[paymentService] Body que será enviado:', sanitizeForLog(body));
      const { data, error } = await supabase.functions.invoke('create-mp-preference', { body });

      if (data) {
        devLog.log('[paymentService] Resposta recebida:', data);
      }

      if (error) {
        devLog.error('[paymentService] Erro completo da API:', error);

        if (error?.context) {
          try {
            const response = error.context as Response;
            if (response?.body) {
              const errorText = await response.clone().text();
              devLog.error('[paymentService] Erro da função (texto):', errorText);
              try {
                const errorBody = JSON.parse(errorText) as { details?: string };
                devLog.error('[paymentService] Detalhes do erro da função:', errorBody);
                if (errorBody.details) {
                  throw new Error(errorBody.details);
                }
              } catch (parseError) {
                if (parseError instanceof Error && parseError.message !== errorText) {
                  throw parseError;
                }
                throw new Error(errorText || error.message);
              }
            }
          } catch (e: unknown) {
            if (e instanceof Error && e.message) {
              throw e;
            }
            devLog.error('[paymentService] Erro ao ler resposta:', e);
          }
        }

        throw handleApiError(error);
      }

      if (!data || typeof data !== 'object') {
        throw new Error('Resposta inválida do servidor');
      }

      if (!data.url || !data.session_id) {
        throw new Error('Resposta incompleta do servidor');
      }

      devLog.log('[paymentService] Checkout Pix criado com sucesso');
      return data as CreateCheckoutResponse;
    } catch (error) {
      if (isHandledError(error)) {
        throw error;
      }
      devLog.error('[paymentService] Erro ao processar pagamento');
      throw new Error('Erro inesperado ao processar pagamento. Tente novamente.');
    }
  },

  async waitForPayment(orderId: string, attempts = 20, intervalMs = 3000): Promise<PaymentOrderStatus | null> {
    let latest: PaymentOrderStatus | null = null;
    for (let attempt = 0; attempt < attempts; attempt++) {
      const { data, error } = await supabase
        .from('billing_payment_orders')
        .select('id, plan_id, status, amount, period_ends_at')
        .eq('id', orderId)
        .maybeSingle();

      if (error) {
        devLog.error('[paymentService] Erro ao consultar status do Pix');
        throw new Error('Não foi possível consultar o pagamento. Tente novamente em instantes.');
      }
      latest = data as PaymentOrderStatus | null;
      if (!latest || ['approved', 'rejected', 'cancelled', 'refunded', 'charged_back', 'creation_failed'].includes(latest.status)) {
        return latest;
      }
      if (attempt < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
      }
    }
    return latest;
  },

  async verifySubscription(): Promise<VerifySubscriptionResult> {
    try {
      await ensureValidSession();

      devLog.log('[paymentService] Verificando assinatura no Stripe...');
      const { data, error } = await supabase.functions.invoke('verify-stripe-subscription', {
        body: {},
      });

      if (error) {
        throw handleApiError(error);
      }

      if (!data || typeof data !== 'object') {
        throw new Error('Resposta inválida do servidor');
      }

      devLog.log('[paymentService] Verificação de assinatura concluída:', data);
      return data as VerifySubscriptionResult;
    } catch (error) {
      devLog.error('[paymentService] Erro ao verificar assinatura:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Erro ao verificar assinatura',
      };
    }
  },
};
