# Guia de Migração - Nova Conta Stripe

## 📋 Produtos Identificados (Modo Teste)

Baseado no CSV fornecido, os produtos criados são:

1. **Aluno Pro** - `prod_TONR0h51C5pz9Y`
2. **Intermediário** (10 alunos) - `prod_TONR2PFCmzcZJb`
3. **Avançado** (25 alunos) - `prod_TONSgq35p0ahty`
4. **Inicial** (5 alunos) - `prod_TONT5uCCMlcnS5`

---

## 🔍 Como Obter os Price IDs

### Passo 1: Acessar o Stripe Dashboard
1. Acesse: https://dashboard.stripe.com/test/products
2. Certifique-se de estar no modo **Teste** (toggle no canto superior direito)

### Passo 2: Para cada produto, obter o Price ID

Para cada produto listado acima:

1. Clique no produto no dashboard
2. Na página do produto, você verá a seção **"Pricing"**
3. Cada preço tem um **Price ID** que começa com `price_`
4. **Copie o Price ID** (não o Product ID)

### Exemplo:
- **Produto:** Aluno Pro (`prod_TONR0h51C5pz9Y`)
- **Price ID:** `price_XXXXXXXXXXXXX` ← Este é o que precisamos!

---

## 📝 Mapeamento Necessário

Após obter os Price IDs, você precisará mapeá-los assim:

| Plano no Sistema | Produto Stripe | Price ID (preencher) |
|------------------|----------------|---------------------|
| `pro` | Aluno Pro | `price_???` |
| `coach_starter` | Inicial (5 alunos) | `price_???` |
| `coach_professional` | Intermediário (10 alunos) | `price_???` |
| `coach_enterprise` | Avançado (25 alunos) | `price_???` |

---

## ⚠️ Importante

- **Price IDs são diferentes de Product IDs**
- Cada produto pode ter múltiplos preços (mensal, anual, etc.)
- Use o Price ID do preço **mensal recorrente**
- Certifique-se de estar no modo **Teste** ao copiar os IDs

---

## 📌 Próximos Passos

Após obter os Price IDs, execute:

1. Atualizar `supabase/functions/create-checkout/index.ts`
2. Atualizar `supabase/functions/verify-stripe-subscription/index.ts`
3. Atualizar `supabase/functions/stripe-webhook/index.ts`
4. Atualizar variáveis de ambiente no Supabase
5. Recriar webhook no Stripe

---

**Quando tiver os Price IDs, me avise que eu atualizo o código automaticamente!**

