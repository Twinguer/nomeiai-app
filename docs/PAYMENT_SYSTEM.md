# Sistema de Pagamentos - Documentação Completa

Este documento consolida toda a documentação relacionada ao sistema de pagamentos com Stripe.

---

## 🎯 Visão Geral

O sistema utiliza **Stripe** para processar pagamentos de assinaturas mensais. O fluxo é híbrido, garantindo ativação imediata da assinatura quando o usuário retorna do checkout.

---

## ⚙️ Configuração

### 1. Conta Stripe

- **Nome da Conta:** "Nomeia Aí" (Nova Conta)
- **Modo:** Teste (para produção, usar Price IDs do modo Live)
- **Dashboard:** https://dashboard.stripe.com

### 2. Variáveis de Ambiente Necessárias

**No Supabase Dashboard:**
1. Acesse: Settings → Secrets
2. Adicione a variável:
   - **Nome:** `STRIPE_SECRET_KEY`
   - **Valor:** Sua chave secreta do Stripe (começa com `sk_`)
   - **Tipo:** Secret

**Como obter a chave:**
- Acesse: https://dashboard.stripe.com/apikeys
- Copie a **Secret key** (não a Publishable key)
- Use a chave de **teste** (`sk_test_...`) para desenvolvimento
- Use a chave de **produção** (`sk_live_...`) para produção

### 3. Produtos e Preços Configurados (Modo Teste)

#### Plano Pro (Aluno)
- **Produto:** "Aluno Pro" (`prod_TONR0h51C5pz9Y`)
- **Preço:** R$ 14,90/mês (`price_1SRagSFBsZSweLR7D5kE6D7h`)
- **Tabela:** `user_subscriptions`

#### Modo Coach Inicial
- **Produto:** "Inicial" (`prod_TONT5uCCMlcnS5`)
- **Preço:** R$ 49,90/mês (`price_1SRaimFBsZSweLR714Du0mqE`)
- **Limite:** 5 alunos
- **Tabela:** `coach_subscriptions`

#### Modo Coach Intermediário
- **Produto:** "Intermediário" (`prod_TONR2PFCmzcZJb`)
- **Preço:** R$ 89,90/mês (`price_1SRah0FBsZSweLR7DI1hiPsv`)
- **Limite:** 10 alunos
- **Tabela:** `coach_subscriptions`

#### Modo Coach Avançado
- **Produto:** "Avançado" (`prod_TONSgq35p0ahty`)
- **Preço:** R$ 149,90/mês (`price_1SRai8FBsZSweLR7A93PGay8`)
- **Limite:** 25 alunos
- **Tabela:** `coach_subscriptions`

---

## 🔄 Fluxo Completo de Pagamento

### 1. Usuário Clica em "Assinar"

```
Frontend (Planos.tsx)
  ↓
paymentService.createCheckout(planId)
  ↓
Edge Function: create-checkout
  ↓
Stripe API: Criar Checkout Session
  ↓
Redireciona para: https://checkout.stripe.com/...
```

### 2. Usuário Completa Pagamento no Stripe

```
Stripe Checkout
  ↓
Pagamento processado
  ↓
Stripe cria Subscription
  ↓
Redireciona para: /planos?status=success&plan=<plan_id>
```

### 3. Frontend Verifica e Ativa Imediatamente

```
Frontend detecta: status=success
  ↓
Chama: paymentService.verifySubscription()
  ↓
Edge Function: verify-stripe-subscription
  ↓
Busca customer no Stripe por email
  ↓
Busca subscription ativa
  ↓
Atualiza banco de dados (user_subscriptions ou coach_subscriptions)
  ↓
Assinatura ativada imediatamente
```

### 4. Webhook como Backup (Opcional)

```
Stripe envia evento: checkout.session.completed
  ↓
Edge Function: stripe-webhook
  ↓
Processa evento
  ↓
Atualiza banco de dados (redundância)
```

---

## 🧪 Teste de Pagamentos

### Cartões de Teste do Stripe

#### Cartões que Funcionam (Aprovados)

| Número do Cartão | Descrição | CVC | Data de Validade |
|------------------|-----------|-----|------------------|
| `4242 4242 4242 4242` | Cartão Visa de teste (sucesso) | Qualquer 3 dígitos | Qualquer data futura (ex: 12/34) |
| `5555 5555 5555 4444` | Cartão Mastercard de teste (sucesso) | Qualquer 3 dígitos | Qualquer data futura |
| `4000 0566 5566 5556` | Cartão Visa de débito (sucesso) | Qualquer 3 dígitos | Qualquer data futura |

#### Cartões que Falham (Para Testar Erros)

| Número do Cartão | Descrição | Resultado |
|------------------|-----------|-----------|
| `4000 0000 0000 0002` | Cartão recusado | Pagamento recusado |
| `4000 0000 0000 9995` | Fundos insuficientes | Erro de fundos |
| `4000 0000 0000 0069` | Cartão expirado | Erro de cartão expirado |
| `4000 0000 0000 0127` | CVC incorreto | Erro de CVC |

### Passo a Passo para Testar

1. **Acessar o Checkout**
   - No frontend, clique em "Assinar" no plano desejado
   - Você será redirecionado para o Stripe Checkout
   - A URL deve começar com: `https://checkout.stripe.com/...`

2. **Preencher os Dados do Cartão**
   - **Número do Cartão:** Use um dos cartões de teste acima
   - **Data de Validade:** Qualquer data futura (ex: `12/34`)
   - **CVC:** Qualquer 3 dígitos (ex: `123`)
   - **CEP:** Qualquer CEP válido (ex: `01310-100`)

3. **Completar o Pagamento**
   - Clique em **"Assinar"** ou **"Pagar"**
   - O Stripe processará o pagamento de teste
   - Você será redirecionado de volta para: `/planos?status=success&plan=<plan_id>`

4. **Verificar o Resultado**
   - **Se aprovado:** Mensagem de sucesso, assinatura criada, plano ativado
   - **Se recusado:** Mensagem de erro, nenhuma cobrança, pode tentar novamente

### Verificar no Stripe Dashboard

**Verificar Pagamentos:**
- Acesse: https://dashboard.stripe.com/test/payments
- Veja todos os pagamentos de teste realizados

**Verificar Assinaturas:**
- Acesse: https://dashboard.stripe.com/test/subscriptions
- Veja todas as assinaturas criadas com status, valor, próxima cobrança

---

## 🔧 Edge Functions

### 1. create-checkout

**Função:** Cria uma sessão de checkout no Stripe

**Parâmetros:**
- `planId`: ID do plano (`pro`, `coach_starter`, `coach_professional`, `coach_enterprise`)

**Retorno:**
- URL do checkout para redirecionamento

**Localização:** `supabase/functions/create-checkout/index.ts`

---

### 2. verify-stripe-subscription

**Função:** Verifica e ativa assinatura imediatamente após checkout

**Fluxo:**
1. Busca customer no Stripe por email
2. Busca subscription ativa
3. Identifica tipo de plano (Pro ou Coach)
4. Atualiza tabela correspondente (`user_subscriptions` ou `coach_subscriptions`)
5. Define `expires_at` baseado em `current_period_end`

**Localização:** `supabase/functions/verify-stripe-subscription/index.ts`

---

### 3. stripe-webhook

**Função:** Processa eventos do Stripe via webhook (backup)

**Eventos Processados:**
- `checkout.session.completed` - Checkout concluído
- `customer.subscription.created` - Assinatura criada
- `customer.subscription.updated` - Assinatura atualizada
- `customer.subscription.deleted` - Assinatura cancelada
- `invoice.payment_succeeded` - Pagamento bem-sucedido
- `invoice.payment_failed` - Pagamento falhou

**Localização:** `supabase/functions/stripe-webhook/index.ts`

**Configuração do Webhook:**
1. Acesse: https://dashboard.stripe.com/webhooks
2. Adicione endpoint: `https://<seu-projeto>.supabase.co/functions/v1/stripe-webhook`
3. Selecione eventos a serem enviados
4. Copie o **Signing secret** e adicione como `STRIPE_WEBHOOK_SECRET` no Supabase

---

## 📋 Estrutura de Dados

### Tabela: user_subscriptions

```sql
CREATE TABLE user_subscriptions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  plan_id TEXT NOT NULL, -- 'pro'
  status TEXT NOT NULL, -- 'active', 'canceled', 'past_due'
  stripe_subscription_id TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Tabela: coach_subscriptions

```sql
CREATE TABLE coach_subscriptions (
  id UUID PRIMARY KEY,
  coach_id UUID REFERENCES auth.users(id),
  plan_id TEXT NOT NULL, -- 'coach_starter', 'coach_professional', 'coach_enterprise'
  status TEXT NOT NULL, -- 'active', 'canceled', 'past_due'
  stripe_subscription_id TEXT,
  max_students INTEGER,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 🚨 Troubleshooting

### Problema: Checkout não redireciona

**Solução:**
- Verificar se `STRIPE_SECRET_KEY` está configurada no Supabase
- Verificar logs da função `create-checkout`
- Verificar se o `planId` é válido

### Problema: Assinatura não ativa após pagamento

**Solução:**
- Verificar se `verify-stripe-subscription` está sendo chamada
- Verificar logs da função
- Verificar se o email do usuário corresponde ao customer no Stripe
- Verificar se há subscription ativa no Stripe

### Problema: Webhook não processa eventos

**Solução:**
- Verificar se `STRIPE_WEBHOOK_SECRET` está configurada
- Verificar se o endpoint está correto no Stripe Dashboard
- Verificar logs da função `stripe-webhook`
- Verificar se os eventos estão selecionados no Stripe

### Problema: Erro 500 no checkout

**Solução:**
- Verificar se `STRIPE_SECRET_KEY` está correta
- Verificar se o price ID existe no Stripe
- Verificar logs da função `create-checkout`
- Verificar se o usuário está autenticado

---

## 📝 Notas Importantes

- Todos os planos são mensais com renovação automática
- `expires_at` é calculado baseado em `current_period_end` do Stripe
- Planos Coach dão acesso completo (sem limites de rankings/edições)
- Free pode ir direto para Coach
- Pro pode ir para Coach
- O fluxo híbrido garante ativação imediata mesmo se o webhook falhar

---

## 🔄 Migração de Mercado Pago

Se necessário migrar para Mercado Pago no futuro, consulte:
- `GUIA_MUDAR_PRODUCAO_MERCADOPAGO.md`
- `MERCADOPAGO_IMPLEMENTATION.md`

---

**Última atualização:** Janeiro 2025

