# 🚀 Configuração do Stripe para Produção

Este guia explica como configurar o Stripe para produção após o sistema estar funcionando em modo teste.

---

## 📋 Checklist de Configuração

### ✅ 1. Criar Produtos no Modo LIVE do Stripe

1. Acesse: https://dashboard.stripe.com/products
2. **Certifique-se de estar no modo LIVE** (toggle no canto superior direito)
3. Crie os mesmos produtos que existem no modo teste:
   - **Aluno Pro** - R$ 14,90/mês
   - **Inicial** (5 alunos) - R$ 49,90/mês
   - **Intermediário** (10 alunos) - R$ 89,90/mês
   - **Avançado** (25 alunos) - R$ 149,90/mês

### ✅ 2. Obter Price IDs do Modo LIVE

Para cada produto criado:

1. Clique no produto no dashboard
2. Na seção **"Pricing"**, copie o **Price ID** (começa com `price_`)
3. **IMPORTANTE**: Use o Price ID do preço **mensal recorrente**

### ✅ 3. Atualizar Price IDs no Código

Atualize os seguintes arquivos com os Price IDs do modo LIVE:

#### 3.1. `supabase/functions/create-checkout/index.ts`

Localize a seção `STRIPE_PRICES_LIVE` (linha ~43) e preencha:

```typescript
const STRIPE_PRICES_LIVE = {
  pro: "price_SEU_PRICE_ID_LIVE_AQUI", // R$ 14,90/mês - Aluno Pro
  coach_starter: "price_SEU_PRICE_ID_LIVE_AQUI", // R$ 49,90/mês - Modo Coach Inicial
  coach_professional: "price_SEU_PRICE_ID_LIVE_AQUI", // R$ 89,90/mês - Modo Coach Intermediário
  coach_enterprise: "price_SEU_PRICE_ID_LIVE_AQUI", // R$ 149,90/mês - Modo Coach Avançado
};
```

#### 3.2. `supabase/functions/verify-stripe-subscription/index.ts`

Localize a seção `STRIPE_PRICES_LIVE` (linha ~280) e preencha:

```typescript
const STRIPE_PRICES_LIVE: Record<string, string> = {
  "price_SEU_PRICE_ID_LIVE_AQUI": "pro",
  "price_SEU_PRICE_ID_LIVE_AQUI": "coach_starter",
  "price_SEU_PRICE_ID_LIVE_AQUI": "coach_professional",
  "price_SEU_PRICE_ID_LIVE_AQUI": "coach_enterprise"
};
```

#### 3.3. `supabase/functions/stripe-webhook/index.ts`

Localize a seção `STRIPE_PRICES_LIVE` (linha ~25) e preencha:

```typescript
const STRIPE_PRICES_LIVE: Record<string, string> = {
  "price_SEU_PRICE_ID_LIVE_AQUI": "pro",
  "price_SEU_PRICE_ID_LIVE_AQUI": "coach_starter",
  "price_SEU_PRICE_ID_LIVE_AQUI": "coach_professional",
  "price_SEU_PRICE_ID_LIVE_AQUI": "coach_enterprise"
};
```

### ✅ 4. Atualizar Variáveis de Ambiente no Supabase

**Acesse:** Supabase Dashboard → Settings → Secrets

#### 4.1. Atualizar `STRIPE_SECRET_KEY`

- **Nome:** `STRIPE_SECRET_KEY`
- **Valor:** Chave secreta do modo **LIVE** (começa com `sk_live_`)
- **Como obter:** https://dashboard.stripe.com/apikeys (certifique-se de estar no modo LIVE)
- **Tipo:** Secret

⚠️ **IMPORTANTE**: Substitua a chave de teste pela chave de produção.

#### 4.2. Atualizar `STRIPE_WEBHOOK_SECRET`

- **Nome:** `STRIPE_WEBHOOK_SECRET`
- **Valor:** Signing Secret do webhook do modo **LIVE** (começa com `whsec_`)
- **Como obter:** Após criar o webhook no modo LIVE (veja passo 5)
- **Tipo:** Secret

### ✅ 5. Configurar Webhook no Modo LIVE

1. Acesse: https://dashboard.stripe.com/webhooks
2. **Certifique-se de estar no modo LIVE**
3. Clique em **"Adicionar endpoint"**
4. Configure:
   - **URL do endpoint:** `https://<seu-projeto>.supabase.co/functions/v1/stripe-webhook`
   - **Eventos a serem enviados:**
     - `checkout.session.completed`
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_succeeded`
     - `invoice.payment_failed`
5. Copie o **Signing secret** (começa com `whsec_`)
6. Adicione como `STRIPE_WEBHOOK_SECRET` no Supabase (passo 4.2)

### ✅ 6. Fazer Deploy das Edge Functions

Após atualizar os Price IDs no código:

```bash
# Fazer deploy de todas as funções
supabase functions deploy create-checkout
supabase functions deploy verify-stripe-subscription
supabase functions deploy stripe-webhook
```

Ou faça deploy de todas de uma vez:

```bash
supabase functions deploy
```

### ✅ 7. Testar em Produção

1. Acesse o site em produção: https://nomeiai.com.br
2. Teste o fluxo de checkout com um cartão de teste do Stripe
3. Verifique se a assinatura é ativada corretamente
4. Verifique os logs das Edge Functions no Supabase Dashboard

---

## 🔍 Como o Sistema Detecta Modo Teste vs Produção

O sistema detecta automaticamente o modo baseado na chave `STRIPE_SECRET_KEY`:

- **Modo TESTE**: Chave começa com `sk_test_` → Usa `STRIPE_PRICES_TEST`
- **Modo PRODUÇÃO**: Chave começa com `sk_live_` → Usa `STRIPE_PRICES_LIVE`

**Não é necessário alterar código** - apenas atualizar a chave no Supabase e os Price IDs nos arquivos.

---

## ⚠️ Avisos Importantes

1. **Nunca use chaves de teste em produção** - Isso resultará em pagamentos falsos
2. **Nunca use chaves de produção em desenvolvimento** - Isso resultará em cobranças reais
3. **Sempre teste primeiro no modo teste** antes de ir para produção
4. **Mantenha os Price IDs sincronizados** entre os 3 arquivos de Edge Functions
5. **Verifique os logs** após fazer deploy para garantir que não há erros

---

## 🐛 Troubleshooting

### Erro: "Price ID não configurado para o plano X no modo PRODUÇÃO"

**Causa:** Price IDs de produção não foram preenchidos corretamente.

**Solução:**
1. Verifique se preencheu todos os Price IDs em `STRIPE_PRICES_LIVE`
2. Certifique-se de que não há `"PREENCHER_COM_PRICE_ID_LIVE"` nos arquivos
3. Verifique se os Price IDs são do modo LIVE (não teste)

### Erro: "Chave Stripe inválida"

**Causa:** A chave não começa com `sk_test_` ou `sk_live_`.

**Solução:**
1. Verifique se copiou a chave correta (Secret key, não Publishable key)
2. Certifique-se de que está usando a chave do modo correto (teste ou live)

### Webhook não processa eventos

**Causa:** `STRIPE_WEBHOOK_SECRET` não está configurado ou está incorreto.

**Solução:**
1. Verifique se o webhook foi criado no modo correto (LIVE para produção)
2. Verifique se o Signing secret foi copiado corretamente
3. Verifique se a URL do webhook está correta no Stripe Dashboard

---

## 📝 Mapeamento de Planos

| Plano no Sistema | Produto Stripe | Preço Mensal | Price ID (Teste) | Price ID (Live) |
|------------------|---------------|--------------|------------------|-----------------|
| `pro` | Aluno Pro | R$ 14,90 | `price_1SRagSFBsZSweLR7D5kE6D7h` | `price_1SRaGrFbBP7AYhAYK3UISUzO` ✅ |
| `coach_starter` | Inicial | R$ 49,90 | `price_1SRaimFBsZSweLR714Du0mqE` | `price_1SRaHbFbBP7AYhAYcjvOF6bB` ✅ |
| `coach_professional` | Intermediário | R$ 89,90 | `price_1SRah0FBsZSweLR7DI1hiPsv` | `price_1SRaI8FbBP7AYhAYWHNeSPMW` ✅ |
| `coach_enterprise` | Avançado | R$ 149,90 | `price_1SRai8FBsZSweLR7A93PGay8` | `price_1SRaIbFbBP7AYhAYgbDmmBdG` ✅ |

---

**Última atualização:** Janeiro 2025

