# 🚀 Como Fazer Deploy das Edge Functions Atualizadas

## ⚠️ Problema

A Edge Function `create-checkout` no Supabase ainda está usando os Price IDs antigos, causando o erro:
```
Price ID não encontrado no Stripe. Price usado: price_1SQwL6QOI1Sr9J1A87vPtQs5
```

## ✅ Solução: Deploy das Funções Atualizadas

### Opção 1: Deploy via Supabase Dashboard (Recomendado)

1. **Acesse o Supabase Dashboard:**
   - https://supabase.com/dashboard/project/ppsymqrdtjyaguftracc/functions

2. **Para cada função, faça o deploy:**
   
   **a) create-checkout:**
   - Clique em `create-checkout`
   - Clique em "Edit Function" ou "Deploy"
   - Copie o conteúdo de `supabase/functions/create-checkout/index.ts`
   - Cole no editor do Supabase
   - Clique em "Deploy" ou "Save"

   **b) verify-stripe-subscription:**
   - Clique em `verify-stripe-subscription`
   - Clique em "Edit Function"
   - Copie o conteúdo de `supabase/functions/verify-stripe-subscription/index.ts`
   - Cole no editor do Supabase
   - Clique em "Deploy"

   **c) stripe-webhook:**
   - Clique em `stripe-webhook`
   - Clique em "Edit Function"
   - Copie o conteúdo de `supabase/functions/stripe-webhook/index.ts`
   - Cole no editor do Supabase
   - Clique em "Deploy"

---

### Opção 2: Deploy via Supabase CLI (Se tiver instalado)

```bash
# Instalar Supabase CLI (se não tiver)
npm install -g supabase

# Fazer login
supabase login

# Linkar ao projeto
supabase link --project-ref ppsymqrdtjyaguftracc

# Deploy das funções
supabase functions deploy create-checkout
supabase functions deploy verify-stripe-subscription
supabase functions deploy stripe-webhook
```

---

### Opção 3: Deploy Individual via Dashboard (Mais Rápido)

1. Acesse: https://supabase.com/dashboard/project/ppsymqrdtjyaguftracc/functions/create-checkout
2. Clique em "Edit Function"
3. Abra o arquivo local: `supabase/functions/create-checkout/index.ts`
4. Copie TODO o conteúdo
5. Cole no editor do Supabase
6. Clique em "Deploy"
7. Repita para as outras 2 funções

---

## ✅ Verificação Após Deploy

Após fazer o deploy, teste novamente:

1. Acesse a página de planos
2. Clique em "Assinar" no plano Pro
3. Verifique se não há mais erro de Price ID

---

## 📝 Arquivos que Precisam de Deploy

- ✅ `supabase/functions/create-checkout/index.ts` - **CRÍTICO**
- ✅ `supabase/functions/verify-stripe-subscription/index.ts` - Importante
- ✅ `supabase/functions/stripe-webhook/index.ts` - Importante

---

**Após o deploy, o erro deve desaparecer!**

