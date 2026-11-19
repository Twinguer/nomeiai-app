# 🔄 Implementação de Upgrade/Downgrade de Planos

## ✅ Implementado

### Lógica de Upgrade/Downgrade Automático

A função `create-checkout` agora detecta automaticamente se o usuário já tem uma assinatura ativa do mesmo tipo (Pro ou Coach) e faz upgrade/downgrade em vez de criar uma nova assinatura.

---

## 📋 Como Funciona

### 1. Verificação de Assinatura Existente

Quando o usuário clica em "Assinar" em um plano diferente:

1. **Busca customer no Stripe** por email
2. **Lista assinaturas ativas** do customer
3. **Verifica se há assinatura do mesmo tipo:**
   - Se tem Pro e quer outro Pro → Upgrade/Downgrade
   - Se tem Coach e quer outro Coach → Upgrade/Downgrade
   - Se tem Pro e quer Coach → Nova assinatura (tipos diferentes)
   - Se tem Coach e quer Pro → Nova assinatura (tipos diferentes)

### 2. Upgrade/Downgrade Automático

Se detectar assinatura existente do mesmo tipo:

1. **Atualiza a assinatura** usando `stripe.subscriptions.update()`
2. **Stripe calcula prorating automaticamente:**
   - Crédito proporcional do plano antigo
   - Valor proporcional do novo plano
   - Diferença a pagar (ou crédito a receber)

3. **Se há cobrança pendente:**
   - Redireciona para página de pagamento da invoice
   - Usuário paga a diferença proporcional

4. **Se não há cobrança (downgrade com crédito):**
   - Redireciona para página de sucesso
   - Plano atualizado imediatamente

### 3. Criação de Nova Assinatura

Se não há assinatura do mesmo tipo:
- Cria nova assinatura via checkout (comportamento original)

---

## 💰 Exemplo de Cálculo (Prorating)

### Cenário: Upgrade de Inicial para Avançado

**Situação:**
- Plano Inicial: R$ 49,90/mês
- Usado: 10 dias de 30
- Restante: 20 dias

**Cálculo do Stripe:**
1. **Crédito do plano antigo:**
   - R$ 49,90 × (20/30) = R$ 33,27

2. **Valor do novo plano (proporcional):**
   - R$ 149,90 × (20/30) = R$ 99,93

3. **Diferença a pagar:**
   - R$ 99,93 - R$ 33,27 = **R$ 66,66**

**Resultado:**
- Usuário paga apenas R$ 66,66 (não o valor total)
- Plano atualizado imediatamente
- Próxima renovação: R$ 149,90/mês

---

## 🔄 Fluxo Completo

### Upgrade (com cobrança)

```
Usuário clica "Assinar" no plano Avançado
  ↓
create-checkout detecta assinatura Inicial ativa
  ↓
Atualiza assinatura via Stripe API
  ↓
Stripe calcula prorating (R$ 66,66)
  ↓
Cria invoice com valor proporcional
  ↓
Redireciona para página de pagamento da invoice
  ↓
Usuário paga R$ 66,66
  ↓
Webhook recebe invoice.payment_succeeded
  ↓
Atualiza banco de dados com novo plano
  ↓
Usuário tem acesso ao plano Avançado
```

### Downgrade (com crédito)

```
Usuário clica "Assinar" no plano Inicial
  ↓
create-checkout detecta assinatura Avançado ativa
  ↓
Atualiza assinatura via Stripe API
  ↓
Stripe calcula prorating (crédito > valor)
  ↓
Aplica crédito, sem cobrança imediata
  ↓
Redireciona para página de sucesso
  ↓
Webhook recebe customer.subscription.updated
  ↓
Atualiza banco de dados com novo plano
  ↓
Usuário tem acesso ao plano Inicial
```

---

## ⚙️ Configuração do Stripe

### Prorating Automático

O Stripe faz prorating automaticamente quando você atualiza uma subscription usando:
- `proration_behavior: 'always_invoice'` - Sempre cria invoice com prorating

### Opções de Prorating

- `always_invoice` - Sempre criar invoice (usado)
- `create_prorations` - Criar prorations mas não invoice imediatamente
- `none` - Sem prorating

---

## 📝 Eventos do Webhook

Quando há upgrade/downgrade, o Stripe envia:

1. **`customer.subscription.updated`** - Assinatura atualizada
2. **`invoice.created`** - Invoice criada (se houver cobrança)
3. **`invoice.payment_succeeded`** - Pagamento bem-sucedido (se houver cobrança)

O webhook já trata esses eventos e atualiza o banco de dados automaticamente.

---

## ✅ Benefícios

1. **Sem assinaturas duplicadas** - Uma única assinatura por tipo
2. **Prorating automático** - Stripe calcula proporcionalmente
3. **Transparente para o usuário** - Paga apenas a diferença
4. **Atualização imediata** - Plano muda na hora
5. **Crédito em downgrades** - Usuário recebe crédito proporcional

---

## 🧪 Teste

Para testar upgrade/downgrade:

1. Adquira plano Inicial (R$ 49,90)
2. Aguarde alguns dias
3. Clique em "Assinar" no plano Avançado
4. Verifique:
   - Não cria nova assinatura
   - Atualiza assinatura existente
   - Cobra apenas diferença proporcional
   - Plano atualizado imediatamente

---

**Data da Implementação:** 09 de Novembro de 2025  
**Status:** ✅ Implementado e Deployado

