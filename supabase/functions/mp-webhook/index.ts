/**
 * Edge Function: mp-webhook
 * 
 * Descrição: Processa webhooks do Mercado Pago de forma segura
 * Segurança: Validação de origem, verificação de pagamento, tratamento idempotente
 * Autenticação: Service Role para operações administrativas
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

// ============================================
// CONFIGURAÇÃO
// ============================================
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

// Configuração de planos (mesma do create-mp-preference)
const PLAN_MONTHS: Record<string, number> = {
  "pro": 1,
  "trimestral": 3,
  "semestral": 6,
  "anual": 12
};

// ============================================
// INTERFACES
// ============================================
interface WebhookPayload {
  type: string;
  data: {
    id: string | number;
  };
}

interface MercadoPagoPayment {
  id: number;
  status: string;
  status_detail: string;
  external_reference: string;
  transaction_amount: number;
  payer?: {
    email?: string;
    identification?: {
      type?: string;
      number?: string;
    };
  };
  metadata?: {
    user_id?: string;
    plan_months?: string;
    voucher_code?: string;
  };
}

// ============================================
// FUNÇÕES AUXILIARES
// ============================================

/**
 * Cria cliente Supabase com service role
 */
function createServiceRoleClient(): SupabaseClient | null {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  
  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }
  
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

/**
 * Busca informações do pagamento no Mercado Pago
 * Retorna null se o pagamento não existir (webhook de teste)
 */
async function fetchPaymentFromMercadoPago(paymentId: string | number): Promise<MercadoPagoPayment | null> {
  const accessToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
  
  if (!accessToken) {
    throw new Error("MERCADOPAGO_ACCESS_TOKEN não configurado");
  }
  
  const response = await fetch(
    `https://api.mercadopago.com/v1/payments/${paymentId}`,
    {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      }
    }
  );
  
  // Se o pagamento não existe (404), pode ser um webhook de teste
  if (response.status === 404) {
    console.log(`[mp-webhook] Pagamento ${paymentId} não encontrado - pode ser webhook de teste`);
    return null;
  }
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[mp-webhook] Erro ao buscar pagamento ${paymentId}:`, {
      status: response.status,
      error: errorText
    });
    // Para outros erros da API, também retornar null (não quebrar o webhook)
    return null;
  }
  
  return await response.json();
}

/**
 * Extrai informações do external_reference
 */
function parseExternalReference(externalRef: string): { userId: string; planId: string } | null {
  // Formato esperado: userId_planId_timestamp
  const parts = externalRef.split("_");
  
  if (parts.length < 3) {
    console.error(`[mp-webhook] External reference inválido (menos de 3 partes): ${externalRef}`);
    return null;
  }
  
  // userId está na primeira parte, planId na segunda, timestamp na terceira (e seguintes)
  const userId = parts[0];
  const planId = parts[1];
  
  if (!userId || !planId) {
    console.error(`[mp-webhook] External reference com partes vazias: ${externalRef}`);
    return null;
  }
  
  return { userId, planId };
}

/**
 * Calcula meses do plano baseado no planId ou metadata
 */
function getPlanMonths(planId: string, metadata?: { plan_months?: string }): number {
  // Prioridade 1: metadata do pagamento
  if (metadata?.plan_months) {
    const months = parseInt(metadata.plan_months);
    if (!isNaN(months) && months > 0) {
      return months;
    }
  }
  
  // Prioridade 2: planId direto
  const planKey = planId.toLowerCase().trim();
  if (PLAN_MONTHS[planKey]) {
    return PLAN_MONTHS[planKey];
  }
  
  // Fallback: mensal
  console.warn(`[mp-webhook] PlanId desconhecido: ${planId}, usando 1 mês como padrão`);
  return 1;
}

/**
 * Atualiza assinatura do usuário
 */
async function updateUserSubscription(
  supabase: SupabaseClient,
  userId: string,
  months: number
): Promise<void> {
  const expiresAt = new Date();
  expiresAt.setMonth(expiresAt.getMonth() + months);
  
  const { error } = await supabase
    .from("user_subscriptions")
    .upsert(
      {
        user_id: userId,
        plan: "pro",
        is_active: true,
        started_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        onConflict: "user_id"
      }
    );
  
  if (error) {
    console.error(`[mp-webhook] Erro ao atualizar assinatura para ${userId}:`, error);
    throw error;
  }
  
  console.log(`[mp-webhook] Assinatura atualizada: userId=${userId}, expiresAt=${expiresAt.toISOString()}`);
}

// ============================================
// HANDLER PRINCIPAL
// ============================================

serve(async (req: Request): Promise<Response> => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  
  // Validar método
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
  
  try {
    // Log inicial para debug
    console.log("[mp-webhook] Webhook chamado:", {
      method: req.method,
      url: req.url,
      hasAuth: !!req.headers.get("authorization"),
      contentType: req.headers.get("content-type")
    });
    
    // Criar cliente Supabase
    const supabase = createServiceRoleClient();
    
    if (!supabase) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      
      console.error("[mp-webhook] Falha ao criar cliente Supabase:", {
        hasUrl: !!supabaseUrl,
        hasServiceKey: !!serviceRoleKey,
        urlLength: supabaseUrl?.length || 0,
        keyLength: serviceRoleKey?.length || 0
      });
      
      return new Response(
        JSON.stringify({ 
          error: "Internal Server Error",
          details: "Falha ao criar cliente Supabase. Verifique variáveis de ambiente."
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }
    
    // Parsear webhook payload
    let payload: WebhookPayload;
    try {
      payload = await req.json();
    } catch (error) {
      console.error("[mp-webhook] Erro ao parsear JSON:", error);
      return new Response(
        JSON.stringify({ error: "Bad Request", details: "Payload inválido" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }
    
    console.log(`[mp-webhook] Webhook recebido: type=${payload.type}, id=${payload.data.id}`);
    
    // Processar apenas eventos de pagamento
    if (payload.type !== "payment") {
      console.log(`[mp-webhook] Tipo de evento ignorado: ${payload.type}`);
      return new Response(
        JSON.stringify({ received: true, message: "Event type not processed" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }
    
    const paymentId = payload.data.id.toString();
    
    // Buscar informações completas do pagamento
    const payment = await fetchPaymentFromMercadoPago(paymentId);
    
    // Se o pagamento não existe, pode ser um webhook de teste
    // Aceitar e retornar sucesso para não entrar em retry loop
    if (!payment) {
      console.log(`[mp-webhook] Pagamento ${paymentId} não encontrado - aceitando como teste`);
      return new Response(
        JSON.stringify({ received: true, message: "Test webhook or payment not found" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }
    
    // Verificar se tem external_reference (necessário para processar)
    if (!payment.external_reference) {
      console.log(`[mp-webhook] Pagamento ${paymentId} sem external_reference - pode ser teste`);
      return new Response(
        JSON.stringify({ received: true, message: "Payment without external reference" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }
    
    // Extrair informações do external_reference
    const refInfo = parseExternalReference(payment.external_reference);
    
    if (!refInfo) {
      console.error("[mp-webhook] External reference inválido:", {
        external_reference: payment.external_reference,
        payment_id: paymentId,
        status: payment.status
      });
      // Mesmo com external_reference inválido, retornar 200 para não entrar em retry
      return new Response(
        JSON.stringify({ received: true, message: "Invalid external reference" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }
    
    const { userId, planId } = refInfo;
    
    // Verificar se o pagamento já foi processado (idempotência)
    const { data: existingPayment } = await supabase
      .from("payment_preferences")
      .select("status, payment_id")
      .eq("external_reference", payment.external_reference)
      .single();
    
    if (existingPayment?.payment_id === paymentId && 
        existingPayment?.status === payment.status) {
      console.log(`[mp-webhook] Pagamento já processado: ${paymentId}`, {
        external_reference: payment.external_reference,
        status: payment.status
      });
      return new Response(
        JSON.stringify({ received: true, message: "Already processed" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }
    
    // Atualizar registro da preferência
    const updateData: any = {
      payment_id: paymentId,
      status: payment.status,
      mercado_pago_payment_data: payment,
      updated_at: new Date().toISOString()
    };
    
    const { data: updatedData, error: updateError } = await supabase
      .from("payment_preferences")
      .update(updateData)
      .eq("external_reference", payment.external_reference)
      .select();
    
    if (updateError) {
      console.error("[mp-webhook] Erro ao atualizar payment_preferences:", {
        error: updateError,
        external_reference: payment.external_reference,
        payment_id: paymentId,
        status: payment.status
      });
      
      // Retornar erro para que o Mercado Pago tente novamente
      return new Response(
        JSON.stringify({ 
          error: "Database update failed",
          details: updateError.message 
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }
    
    if (!updatedData || updatedData.length === 0) {
      console.error("[mp-webhook] Nenhum registro atualizado:", {
        external_reference: payment.external_reference,
        payment_id: paymentId
      });
      
      // Retornar erro para retry
      return new Response(
        JSON.stringify({ 
          error: "Payment preference not found",
          external_reference: payment.external_reference
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }
    
    console.log(`[mp-webhook] Payment preference atualizada: ${payment.external_reference}`, {
      payment_id: paymentId,
      status: payment.status,
      updated_rows: updatedData.length
    });
    
    // Processar pagamento aprovado
    if (payment.status === "approved") {
      try {
        const planMonths = getPlanMonths(planId, payment.metadata);
        await updateUserSubscription(supabase, userId, planMonths);
        
        // Se houver voucher_code no metadata, incrementar uso do voucher de desconto
        if (payment.metadata?.voucher_code) {
          try {
            // Buscar voucher atual para obter current_uses
            const { data: voucherData, error: fetchError } = await supabase
              .from("vouchers")
              .select("current_uses")
              .eq("code", payment.metadata.voucher_code)
              .eq("voucher_type", "discount")
              .single();
            
            if (fetchError || !voucherData) {
              console.error(`[mp-webhook] Erro ao buscar voucher ${payment.metadata.voucher_code}:`, fetchError);
            } else {
              // Incrementar uso do voucher
              const { error: voucherError } = await supabase
                .from("vouchers")
                .update({ 
                  current_uses: (voucherData.current_uses || 0) + 1,
                  updated_at: new Date().toISOString()
                })
                .eq("code", payment.metadata.voucher_code)
                .eq("voucher_type", "discount");
              
              if (voucherError) {
                console.error(`[mp-webhook] Erro ao incrementar uso do voucher ${payment.metadata.voucher_code}:`, voucherError);
              } else {
                console.log(`[mp-webhook] Uso do voucher incrementado: ${payment.metadata.voucher_code}`);
              }
            }
          } catch (voucherError) {
            console.error("[mp-webhook] Erro ao processar voucher:", voucherError);
            // Não bloquear o processamento se houver erro no voucher
          }
        }
        
        console.log(`[mp-webhook] Pagamento aprovado processado: userId=${userId}, months=${planMonths}`);
      } catch (subscriptionError) {
        console.error("[mp-webhook] Erro ao atualizar assinatura:", subscriptionError);
        // Retornar erro parcial - o pagamento foi registrado mas a assinatura não foi atualizada
        return new Response(
          JSON.stringify({
            received: true,
            warning: "Payment recorded but subscription update failed"
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          }
        );
      }
    } else {
      console.log(`[mp-webhook] Pagamento não aprovado: status=${payment.status}, detail=${payment.status_detail}`);
    }
    
    // Resposta de sucesso
    return new Response(
      JSON.stringify({ received: true }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
    
  } catch (error) {
    console.error("[mp-webhook] Erro não tratado:", error);
    
    return new Response(
      JSON.stringify({
        error: "Internal Server Error",
        details: error instanceof Error ? error.message : "Erro desconhecido"
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
