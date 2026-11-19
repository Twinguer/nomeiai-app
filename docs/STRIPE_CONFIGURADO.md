# ✅ Stripe Configurado para Produção

## 📋 Status da Configuração

✅ **Price IDs de Produção Configurados**

Todos os Price IDs de produção foram atualizados nos arquivos de Edge Functions.

---

## 🔑 Informações de Configuração

### Price IDs de Produção (LIVE)

| Plano | Price ID |
|-------|----------|
| **Aluno Pro** | `price_1SRaGrFbBP7AYhAYK3UISUzO` |
| **Coach Inicial** | `price_1SRaHbFbBP7AYhAYcjvOF6bB` |
| **Coach Intermediário** | `price_1SRaI8FbBP7AYhAYWHNeSPMW` |
| **Coach Avançado** | `price_1SRaIbFbBP7AYhAYgbDmmBdG` |

### Chave Pública (Publishable Key)

```
pk_live_51SRa1YFbBP7AYhAYeKswAkNdazi1ZJt1uDtueVkPhk0OnsmY9S9PlgyBY2iZVHPva7IeAoz3eu2Ch5gsJ3u6w00J00r0StvvAy
```

**Nota:** A chave pública não é necessária para as Edge Functions (elas usam a chave secreta). Se precisar usar no frontend, configure como variável de ambiente `VITE_STRIPE_PUBLISHABLE_KEY`.

---

## ✅ Arquivos Atualizados

1. ✅ `supabase/functions/create-checkout/index.ts`
   - `STRIPE_PRICES_LIVE` atualizado com Price IDs de produção

2. ✅ `supabase/functions/verify-stripe-subscription/index.ts`
   - `STRIPE_PRICES_LIVE` atualizado com Price IDs de produção

3. ✅ `supabase/functions/stripe-webhook/index.ts`
   - `STRIPE_PRICES_LIVE` atualizado com Price IDs de produção

---

## ⚠️ Próximos Passos Necessários

### 1. ✅ Chave Secreta de Produção Configurada

**Status:** ✅ **CONCLUÍDO**

A variável `STRIPE_SECRET_KEY` foi atualizada para a chave de produção (`sk_live_...`).

O sistema agora está em **modo PRODUÇÃO** e usará automaticamente os Price IDs de produção configurados.

### 2. ✅ Webhook Configurado no Stripe

**Status:** ✅ **CONCLUÍDO**

Webhook(s) configurado(s) e ativo(s) no Stripe:
- **Endpoint:** `https://ppsymqrdtjyaguftracc.supabase.co/functions/v1/stripe-webhook`
- **Status:** Ativo
- **Taxa de erros:** 0%

⚠️ **Próximo passo:** Verificar se o **Signing secret** foi adicionado como `STRIPE_WEBHOOK_SECRET` no Supabase:
1. No Stripe, clique no webhook configurado
2. Na seção "Assinatura" (Signing secret), copie o valor (começa com `whsec_`)
3. Adicione no Supabase Dashboard → Settings → Secrets como `STRIPE_WEBHOOK_SECRET`

### 3. Fazer Deploy das Edge Functions

Após configurar as variáveis de ambiente:

```bash
supabase functions deploy create-checkout
supabase functions deploy verify-stripe-subscription
supabase functions deploy stripe-webhook
```

Ou deploy de todas:

```bash
supabase functions deploy
```

---

## 🔍 Como Funciona

O sistema detecta automaticamente o modo baseado na chave `STRIPE_SECRET_KEY`:

- **Modo TESTE**: Chave começa com `sk_test_` → Usa `STRIPE_PRICES_TEST`
- **Modo PRODUÇÃO**: Chave começa com `sk_live_` → Usa `STRIPE_PRICES_LIVE`

**Não é necessário alterar código** - apenas atualizar a chave no Supabase.

---

## ✅ Checklist Final

- [x] Price IDs de produção configurados no código
- [x] `STRIPE_SECRET_KEY` configurada com chave de produção (`sk_live_...`)
- [x] Webhook configurado no Stripe (modo LIVE) - Ativo, 0% erro
- [ ] `STRIPE_WEBHOOK_SECRET` configurado no Supabase (verificar se já foi adicionado)
- [ ] Edge Functions deployadas
- [ ] Teste realizado em produção

---

**Última atualização:** Janeiro 2025

