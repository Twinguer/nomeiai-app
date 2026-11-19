# ✅ Migração para Nova Conta Stripe - CONCLUÍDA

## 📋 Alterações Realizadas

### ✅ Price IDs Atualizados

Todos os Price IDs foram atualizados nos 3 arquivos principais:

#### Mapeamento de Planos:

| Plano no Sistema | Produto Stripe | Price ID (Teste) |
|------------------|----------------|------------------|
| `pro` | Aluno Pro | `price_1SRagSFBsZSweLR7D5kE6D7h` |
| `coach_starter` | Inicial (5 alunos) | `price_1SRaimFBsZSweLR714Du0mqE` |
| `coach_professional` | Intermediário (10 alunos) | `price_1SRah0FBsZSweLR7DI1hiPsv` |
| `coach_enterprise` | Avançado (25 alunos) | `price_1SRai8FBsZSweLR7A93PGay8` |

---

### ✅ Arquivos Atualizados

1. **`supabase/functions/create-checkout/index.ts`**
   - ✅ `STRIPE_PRICES` atualizado com novos Price IDs

2. **`supabase/functions/verify-stripe-subscription/index.ts`**
   - ✅ Mapeamento `priceToPlan` atualizado

3. **`supabase/functions/stripe-webhook/index.ts`**
   - ✅ 3 ocorrências do mapeamento `priceToPlan` atualizadas

4. **`docs/PAYMENT_SYSTEM.md`**
   - ✅ Documentação atualizada com novos Product IDs e Price IDs

---

## ⚠️ Ações Pendentes (Você precisa fazer)

### 1. Atualizar Variáveis de Ambiente no Supabase

**Acesse:** Supabase Dashboard → Settings → Secrets

#### Atualizar `STRIPE_SECRET_KEY`:
- **Nome:** `STRIPE_SECRET_KEY`
- **Valor:** Nova Secret Key da nova conta Stripe (começa com `sk_test_` para teste)
- **Como obter:** https://dashboard.stripe.com/apikeys

#### Adicionar `STRIPE_WEBHOOK_SECRET`:
- **Nome:** `STRIPE_WEBHOOK_SECRET`
- **Valor:** Signing Secret do webhook (começa com `whsec_`)
- **Como obter:** Após criar o webhook no Stripe Dashboard

---

### 2. Recriar Webhook no Stripe

1. Acesse: https://dashboard.stripe.com/test/webhooks
2. Clique em "Adicionar endpoint"
3. Configure:
   - **URL:** `https://ppsymqrdtjyaguftracc.supabase.co/functions/v1/stripe-webhook`
   - **Eventos a enviar:**
     - `checkout.session.completed`
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_succeeded`
     - `invoice.payment_failed`
4. Copie o **Signing Secret** (`whsec_...`)
5. Adicione no Supabase como `STRIPE_WEBHOOK_SECRET`

---

### 3. Testar a Integração

1. **Teste de Checkout:**
   - Acesse a página de planos
   - Tente criar um checkout
   - Use cartão de teste: `4242 4242 4242 4242`

2. **Verificar Webhook:**
   - Após pagamento de teste, verifique se o webhook recebeu o evento
   - Verifique logs no Supabase Dashboard → Edge Functions → stripe-webhook

---

## 📝 Notas Importantes

- ✅ **Price IDs atualizados** - Código pronto para nova conta
- ⚠️ **Variáveis de ambiente** - Precisa atualizar no Supabase
- ⚠️ **Webhook** - Precisa recriar na nova conta
- ⚠️ **Modo Teste vs Live** - Os Price IDs são diferentes entre teste e produção

---

## 🔄 Quando Migrar para Produção

Quando estiver pronto para produção:

1. Criar produtos e preços no modo **Live** do Stripe
2. Obter novos Price IDs do modo Live
3. Atualizar os mesmos 3 arquivos com os Price IDs de produção
4. Atualizar `STRIPE_SECRET_KEY` para chave de produção (`sk_live_...`)
5. Recriar webhook no modo Live
6. Atualizar `STRIPE_WEBHOOK_SECRET` com o novo Signing Secret

---

**Data da Migração:** 09 de Novembro de 2025  
**Status:** ✅ Código atualizado - Pendente configuração de variáveis de ambiente

