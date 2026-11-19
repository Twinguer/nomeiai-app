/**
 * Edge Function: create-mp-preference
 * 
 * Descrição: Cria preferência de pagamento no Mercado Pago de forma segura
 * Autenticação: Requer token JWT válido do Supabase
 * Segurança: Validação de origem, sanitização de dados, tratamento de erros
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================
// CONFIGURAÇÃO DE ORIGENS PERMITIDAS
// ============================================
const PRODUCTION_ORIGINS = [
  "https://nomeiai.com.br",
  "https://www.nomeiai.com.br"
];

const DEVELOPMENT_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:8080"
];

// Padrão para detectar IPs locais
const LOCAL_IP_PATTERN = /^http:\/\/(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|127\.0\.0\.1)/;

// ============================================
// INTERFACES E TIPOS
// ============================================
interface PlanConfig {
  price: number;
  name: string;
  months: number;
  description: string;
}

interface CreatePreferenceRequest {
  email?: string;
  name?: string;
  voucherCode?: string;
}

interface CreatePreferenceResponse {
  init_point: string;
  preference_id: string;
  sandbox_init_point?: string;
}

// ============================================
// CONFIGURAÇÃO DE PLANOS
// ============================================
const PLAN: PlanConfig = {
  price: 21.90,
  name: "Plano Pro",
  months: 1,
  description: "Acesso premium ao Nomeia Aí"
};

// ============================================
// FUNÇÕES AUXILIARES
// ============================================

/**
 * Verifica se a origem é permitida
 */
function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  
  // Verificar origens de produção
  if (PRODUCTION_ORIGINS.includes(origin)) {
    return true;
  }
  
  // Verificar origens de desenvolvimento
  if (DEVELOPMENT_ORIGINS.includes(origin)) {
    return true;
  }
  
  // Verificar IPs locais
  if (LOCAL_IP_PATTERN.test(origin)) {
    return true;
  }
  
  return false;
}

/**
 * Gera headers CORS apropriados
 */
function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowed = isAllowedOrigin(origin);
  
  return {
    "Access-Control-Allow-Origin": allowed && origin ? origin : PRODUCTION_ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400"
  };
}

/**
 * Valida e sanitiza dados da requisição
 */
function validateRequest(data: any): CreatePreferenceRequest | null {
  if (!data || typeof data !== "object") {
    return null;
  }
  
  return {
    email: typeof data.email === "string" ? data.email.trim() : undefined,
    name: typeof data.name === "string" ? data.name.trim() : undefined,
    voucherCode: typeof data.voucherCode === "string" ? data.voucherCode.trim().toUpperCase() : undefined
  };
}


/**
 * Cria preferência no Mercado Pago
 */
async function createMercadoPagoPreference(
  plan: PlanConfig,
  user: { id: string; email?: string; name?: string },
  baseUrl: string,
  supabaseClient: any,
  voucherCode?: string
): Promise<any> {
  const accessToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
  
  if (!accessToken) {
    throw new Error("MERCADOPAGO_ACCESS_TOKEN não configurado no ambiente");
  }
  
  // Validar email obrigatório
  if (!user.email || !user.email.includes("@")) {
    throw new Error("Email do usuário é obrigatório e deve ser válido");
  }
  
  // Validar preço (deve ser positivo e ter no máximo 2 casas decimais)
  if (plan.price <= 0 || plan.price > 999999.99) {
    throw new Error("Preço do plano inválido");
  }
  
  // Validar valor mínimo do Mercado Pago (R$ 0,50)
  if (plan.price < 0.50) {
    throw new Error("O valor do plano é muito baixo. O valor mínimo é R$ 0,50.");
  }
  
  // Validar e aplicar desconto do voucher (se fornecido)
  let finalPrice = plan.price;
  let appliedVoucherCode: string | undefined = undefined;
  
  if (voucherCode && voucherCode.trim()) {
    try {
      const { data: voucherData, error: voucherError } = await supabaseClient.rpc(
        'validate_discount_voucher',
        { voucher_code_param: voucherCode.trim().toUpperCase() }
      );
      
      if (voucherError) {
        console.error('[create-mp-preference] Erro ao validar voucher:', voucherError);
        throw new Error("Erro ao validar cupom de desconto");
      }
      
      if (voucherData?.valid) {
        const { discount_type, discount_value } = voucherData;
        
        if (discount_type === 'percentage') {
          // Desconto percentual: reduzir o valor
          const discountAmount = (plan.price * parseFloat(discount_value)) / 100;
          finalPrice = Math.max(0.50, plan.price - discountAmount); // Mínimo R$ 0,50 (exigência do Mercado Pago)
          console.log(`[create-mp-preference] Desconto percentual aplicado: ${discount_value}% = R$ ${discountAmount.toFixed(2)}`);
        } else if (discount_type === 'fixed') {
          // Desconto fixo: reduzir valor fixo
          finalPrice = Math.max(0.50, plan.price - parseFloat(discount_value)); // Mínimo R$ 0,50 (exigência do Mercado Pago)
          console.log(`[create-mp-preference] Desconto fixo aplicado: R$ ${discount_value}`);
        }
        
        appliedVoucherCode = voucherCode.trim().toUpperCase();
        console.log(`[create-mp-preference] Preço original: R$ ${plan.price.toFixed(2)}, Preço final: R$ ${finalPrice.toFixed(2)}`);
        
        // Validar valor mínimo após desconto
        if (finalPrice < 0.50) {
          console.warn(`[create-mp-preference] ATENÇÃO: Valor final (R$ ${finalPrice.toFixed(2)}) abaixo do mínimo do Mercado Pago (R$ 0,50). Ajustando para R$ 0,50.`);
          finalPrice = 0.50;
        }
      } else {
        throw new Error(voucherData?.error || "Cupom de desconto inválido ou expirado");
      }
    } catch (error: any) {
      // Se o erro já tem mensagem, re-lançar, senão criar erro genérico
      if (error instanceof Error && error.message) {
        throw error;
      }
      throw new Error("Erro ao processar cupom de desconto");
    }
  }
  
  const externalRef = `${user.id}_pro_${Date.now()}`;
  const nameParts = (user.name || user.email.split("@")[0] || "Cliente").split(" ");
  
  // Tratamento do sobrenome - garantir que não seja vazio ou "."
  let surname = nameParts.slice(1).join(" ").substring(0, 80);
  if (!surname || surname.trim().length === 0 || surname === ".") {
    // Usar parte do email ou "Usuario" como fallback
    const emailPart = user.email.split("@")[0];
    surname = emailPart.substring(0, 80) || "Usuario";
  }
  
  // Statement descriptor deve ter no máximo 13 caracteres e apenas letras/números
  const statementDescriptor = "NOMEIA-AI".substring(0, 13).toUpperCase();
  
  // Garantir que as URLs sejam absolutas e válidas
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const notificationUrl = `${supabaseUrl}/functions/v1/mp-webhook`;
  
  // Construir URLs de retorno - garantir que baseUrl seja válido
  let fullBaseUrl: string;
  if (baseUrl && (baseUrl.startsWith("http://") || baseUrl.startsWith("https://"))) {
    fullBaseUrl = baseUrl;
  } else if (baseUrl && baseUrl.trim().length > 0) {
    // Se não tem protocolo, adicionar http:// (para desenvolvimento local)
    fullBaseUrl = `http://${baseUrl.replace(/^\/\//, "").trim()}`;
  } else {
    // Fallback para produção se não houver baseUrl
    fullBaseUrl = PRODUCTION_ORIGINS[0];
  }
  
  // Validar que a URL base é válida
  try {
    const testUrl = new URL(fullBaseUrl);
    if (!testUrl.hostname || testUrl.hostname.length === 0) {
      throw new Error("hostname vazio");
    }
  } catch (e) {
    throw new Error(`URL base inválida: ${fullBaseUrl} - ${e instanceof Error ? e.message : "erro desconhecido"}`);
  }
  
  // Construir URLs de retorno - garantir que sejam strings não vazias
  const successUrl = `${fullBaseUrl}/planos?status=approved`.trim();
  const pendingUrl = `${fullBaseUrl}/planos?status=pending`.trim();
  const failureUrl = `${fullBaseUrl}/planos?status=rejected`.trim();
  
  // Garantir que todas as URLs são válidas e não vazias
  if (!successUrl || successUrl.length === 0 || !pendingUrl || pendingUrl.length === 0 || !failureUrl || failureUrl.length === 0) {
    throw new Error(`URLs de retorno inválidas ou vazias: success="${successUrl}", pending="${pendingUrl}", failure="${failureUrl}"`);
  }
  
  // Validar URLs - garantir que são URLs válidas
  try {
    const successUrlObj = new URL(successUrl);
    const pendingUrlObj = new URL(pendingUrl);
    const failureUrlObj = new URL(failureUrl);
    
    // Verificar se são URLs válidas
    if (!successUrlObj.href || !pendingUrlObj.href || !failureUrlObj.href) {
      throw new Error("URLs não geraram objetos URL válidos");
    }
  } catch (e) {
    throw new Error(`Erro ao validar URLs de retorno: ${e instanceof Error ? e.message : "URL inválida"} - success=${successUrl}, pending=${pendingUrl}, failure=${failureUrl}`);
  }
  
  const preferenceData = {
    items: [
      {
        id: `plano-${plan.name.toLowerCase().replace(/\s+/g, "-")}`,
        title: plan.name.substring(0, 256), // Limite do Mercado Pago
        description: plan.description.substring(0, 256), // Limite do Mercado Pago
        quantity: 1,
        currency_id: "BRL",
        unit_price: parseFloat(finalPrice.toFixed(2)), // Preço final com desconto aplicado
        category_id: "services"
      }
    ],
    payer: {
      name: (nameParts[0] || "Cliente").substring(0, 80),
      surname: surname,
      email: user.email
    },
    back_urls: {
      success: successUrl,
      pending: pendingUrl,
      failure: failureUrl
    },
    auto_return: "approved" as const,
    external_reference: externalRef.substring(0, 256), // Limite do Mercado Pago
    notification_url: notificationUrl,
    statement_descriptor: statementDescriptor,
    binary_mode: false,
    // Calcular número máximo de parcelas
    installments: (() => {
      // Regra: Só é possível parcelar para compras acima de R$ 199,00 (máximo 10 parcelas)
      // Valor mínimo por parcela: R$ 5,00
      const minInstallmentValue = 5.00;
      const minValueForInstallments = 199.00;
      
      if (finalPrice < minValueForInstallments) {
        // Valor abaixo de R$ 199,00: apenas 1 parcela (à vista)
        console.log(`[create-mp-preference] Valor R$ ${finalPrice.toFixed(2)} abaixo de R$ ${minValueForInstallments.toFixed(2)} - usando 1 parcela (à vista)`);
        return 1;
      }
      
      // Valor acima de R$ 199,00: calcular máximo de parcelas
      // Máximo de 10 parcelas ou baseado no valor mínimo por parcela
      const maxByValue = Math.floor(finalPrice / minInstallmentValue);
      const maxInstallments = Math.min(10, maxByValue);
      const installments = Math.max(1, maxInstallments);
      
      console.log(`[create-mp-preference] Valor R$ ${finalPrice.toFixed(2)} acima de R$ ${minValueForInstallments.toFixed(2)} - usando ${installments} parcelas (máximo calculado: ${maxInstallments})`);
      return installments;
    })(),
    // Objeto payment_methods completo (necessário para o Checkout Pro)
    payment_methods: {
      excluded_payment_methods: [],
      excluded_payment_types: [],
      installments: (() => {
        // Mesma lógica de parcelas para payment_methods
        const minInstallmentValue = 5.00;
        const minValueForInstallments = 199.00;
        
        if (finalPrice < minValueForInstallments) {
          return 1; // À vista
        }
        
        const maxByValue = Math.floor(finalPrice / minInstallmentValue);
        const maxInstallments = Math.min(10, maxByValue);
        return Math.max(1, maxInstallments);
      })(),
      default_installments: 1 // Sempre começar com 1 parcela (à vista) como padrão
    },
    metadata: {
      user_id: user.id,
      plan_months: plan.months.toString(),
      ...(appliedVoucherCode && { voucher_code: appliedVoucherCode })
    }
  };
  
  // Validação final antes de enviar
  if (!preferenceData.back_urls || !preferenceData.back_urls.success) {
    throw new Error(`back_urls.success não está definido corretamente: ${JSON.stringify(preferenceData.back_urls)}`);
  }
  
  // Log do payload (sem dados sensíveis)
  const payloadString = JSON.stringify(preferenceData);
  console.log("[create-mp-preference] Creating preference with:", {
    planName: plan.name,
    planPrice: plan.price,
    finalPrice: finalPrice,
    installments: preferenceData.installments,
    paymentMethods: {
      installments: preferenceData.payment_methods?.installments || "not set",
      defaultInstallments: preferenceData.payment_methods?.default_installments || "not set",
      excludedMethods: preferenceData.payment_methods?.excluded_payment_methods?.length || 0,
      excludedTypes: preferenceData.payment_methods?.excluded_payment_types?.length || 0
    },
    userId: user.id,
    userEmail: user.email ? `${user.email.substring(0, 3)}***` : "none",
    payerName: preferenceData.payer.name,
    payerSurname: preferenceData.payer.surname,
    baseUrl: fullBaseUrl,
    successUrl,
    pendingUrl,
    failureUrl,
    hasAccessToken: !!accessToken,
    hasBackUrls: !!preferenceData.back_urls.success,
    backUrlsDefined: {
      success: !!preferenceData.back_urls.success && preferenceData.back_urls.success.length > 0,
      pending: !!preferenceData.back_urls.pending && preferenceData.back_urls.pending.length > 0,
      failure: !!preferenceData.back_urls.failure && preferenceData.back_urls.failure.length > 0
    },
    payloadPreview: payloadString.substring(0, 500) // Primeiros 500 chars do payload
  });
  
  // Verificar se o JSON serializado mantém as URLs
  const parsedPayload = JSON.parse(payloadString);
  if (!parsedPayload.back_urls || !parsedPayload.back_urls.success) {
    console.error("[create-mp-preference] ERRO: back_urls.success está ausente após serialização!", {
      backUrls: parsedPayload.back_urls,
      fullPayload: parsedPayload
    });
    throw new Error("back_urls.success está ausente após serialização JSON");
  }
  
  const response = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${accessToken}`,
      "X-Idempotency-Key": externalRef
    },
    body: payloadString
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    let errorDetails;
    try {
      errorDetails = JSON.parse(errorText);
    } catch {
      errorDetails = { message: errorText };
    }
    
    console.error("[create-mp-preference] Mercado Pago API Error:", {
      status: response.status,
      statusText: response.statusText,
      error: errorDetails,
      payload: {
        price: plan.price,
        finalPrice: finalPrice,
        installments: preferenceData.installments,
        hasEmail: !!user.email,
        payerSurname: preferenceData.payer.surname,
        baseUrl: fullBaseUrl
      }
    });
    
    // Retornar mensagem detalhada do Mercado Pago
    const mpError = errorDetails.message || errorDetails.error || errorText;
    throw new Error(`Erro ao criar preferência no Mercado Pago: ${mpError}`);
  }
  
  const preferenceResponse = await response.json();
  
  // Log da resposta do Mercado Pago (sem dados sensíveis)
  console.log("[create-mp-preference] Preference created successfully:", {
    preference_id: preferenceResponse.id,
    init_point: preferenceResponse.init_point ? "present" : "missing",
    sandbox_init_point: preferenceResponse.sandbox_init_point ? "present" : "missing",
    status: preferenceResponse.status,
    installments: preferenceResponse.payment_methods?.installments || "not specified"
  });
  
  return preferenceResponse;
}

// ============================================
// HANDLER PRINCIPAL
// ============================================

serve(async (req: Request): Promise<Response> => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);
  
  // Tratar OPTIONS (preflight)
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders
    });
  }
  
  // Validar método HTTP
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ 
        error: "Method not allowed",
        details: "Apenas requisições POST são permitidas" 
      }),
      {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }

  try {
    // Criar cliente Supabase (mesmo padrão do calculate-ranking-score)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Verificar autenticação IMEDIATAMENTE
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.error("[create-mp-preference] Auth error:", authError);
      return new Response(
        JSON.stringify({ 
          error: "Unauthorized",
          details: authError?.message || "Token inválido ou expirado. Por favor, faça login novamente." 
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }
    
    console.log(`[create-mp-preference] User authenticated: ${user.id}, email: ${user.email}`);

    // Validar origem após autenticação bem-sucedida
    if (!isAllowedOrigin(origin)) {
      console.warn(`[create-mp-preference] Origem não permitida: ${origin}`);
      return new Response(
        JSON.stringify({ 
          error: "Forbidden",
          details: "Origem não autorizada" 
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }
    
    // Validar e parsear body
    let requestData: CreatePreferenceRequest;
    try {
      const body = await req.json();
      const validated = validateRequest(body);
      
      if (!validated) {
        return new Response(
          JSON.stringify({ 
            error: "Bad Request",
            details: "Dados da requisição inválidos." 
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          }
        );
      }
      
      requestData = validated;
    } catch (error) {
      return new Response(
        JSON.stringify({ 
          error: "Bad Request",
          details: "Body da requisição inválido ou não é JSON" 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }
    
    // Garantir que baseUrl seja sempre válido - usar origin se válido, senão produção
    const baseUrl = (origin && origin.trim()) ? origin : PRODUCTION_ORIGINS[0];
    
    // Validar e garantir email válido
    const userEmail = requestData.email || user.email || user.user_metadata?.email;
    if (!userEmail || !userEmail.includes("@")) {
      return new Response(
        JSON.stringify({ 
          error: "Bad Request",
          details: "Email do usuário é obrigatório. Por favor, atualize seu perfil com um email válido." 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }
    
    // Criar preferência no Mercado Pago
    const preference = await createMercadoPagoPreference(
      PLAN,
      {
        id: user.id,
        email: userEmail,
        name: requestData.name || user.user_metadata?.name || user.user_metadata?.full_name || undefined
      },
      baseUrl,
      supabase,
      requestData.voucherCode
    );
    
    // Salvar preferência no banco de dados
    try {
      const { error: dbError } = await supabase
        .from("payment_preferences")
        .insert({
          user_id: user.id,
          plan_id: "pro",
          preference_id: preference.id,
          external_reference: preference.external_reference,
          amount: PLAN.price,
          status: "pending"
        });
      
      if (dbError) {
        console.error("[create-mp-preference] Database error:", dbError);
        // Não bloquear o retorno se o insert falhar - o pagamento ainda pode ser processado
      } else {
        console.log(`[create-mp-preference] Preference saved: ${preference.id} for user ${user.id}`);
      }
    } catch (dbError) {
      console.error("[create-mp-preference] Database insert exception:", dbError);
    }
    
    // Retornar resposta de sucesso
    const response: CreatePreferenceResponse = {
      init_point: preference.init_point,
      preference_id: preference.id,
      sandbox_init_point: preference.sandbox_init_point
    };
    
    return new Response(
      JSON.stringify(response),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
    
  } catch (error) {
    console.error("[create-mp-preference] Unhandled error:", error);
    
    return new Response(
      JSON.stringify({
        error: "Internal Server Error",
        details: error instanceof Error ? error.message : "Erro desconhecido ao processar requisição"
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
