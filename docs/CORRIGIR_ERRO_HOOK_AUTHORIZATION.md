# 🔧 Corrigir Erro "Hook requires authorization token"

## 🚨 Problema

Erro: **"Hook requires authorization token"** ou **500 Internal Server Error** ao solicitar reset de senha.

## 🔍 Causa

O Auth Hook no Supabase Dashboard está configurado com **"Require Authorization"** ativado, mas os **Send Email Hooks** do Supabase **NÃO usam Bearer tokens** - eles usam **webhook signatures** (standardwebhooks).

## ✅ Solução

### Opção 1: Desativar "Require Authorization" (Recomendado)

1. **Acesse o Supabase Dashboard:**
   - https://supabase.com/dashboard/project/ppsymqrdtjyaguftracc

2. **Navegue até Authentication > Hooks:**
   - Menu lateral > **Authentication** > **Hooks**

3. **Encontre o "Send Email hook":**
   - Procure pelo hook que aponta para `send-password-reset-email`

4. **Edite o hook:**
   - Clique no hook para editar

5. **Desative "Require Authorization":**
   - Procure por uma opção/toggle chamada:
     - "Require Authorization"
     - "Require Auth Token"
     - "Authorization Required"
   - **DESATIVE** essa opção (deve estar OFF/desmarcado)

6. **Salve as alterações:**
   - Clique em **"Save"** ou **"Update"**

### Opção 2: Verificar Configuração do Hook

Certifique-se de que o hook está configurado assim:

- **Hook Type**: `Send Email hook` (não "Password Recovery hook" ou outros)
- **Hook URL**: `https://ppsymqrdtjyaguftracc.supabase.co/functions/v1/send-password-reset-email`
- **HTTP Method**: `POST`
- **Secret**: `v1,whsec_<base64>` (mesmo valor de `SEND_EMAIL_HOOK_SECRET`)
- **Require Authorization**: ❌ **DESATIVADO** (OFF)

## 📝 Como Funciona

### Send Email Hooks (Correto)
- ✅ Usam **webhook signatures** (standardwebhooks)
- ✅ Validação via `wh.verify(payload, headers)`
- ✅ Secret enviado no header `svix-signature`
- ❌ **NÃO** usam Bearer tokens

### Outros Hooks (Diferentes)
- Alguns hooks podem usar Bearer tokens
- Mas **Send Email Hooks** especificamente usam signatures

## 🔍 Verificar se Está Correto

Após desativar "Require Authorization":

1. **Teste o reset de senha:**
   - Solicite reset de senha
   - Deve funcionar sem erro 500

2. **Verifique os logs:**
   - Edge Functions > send-password-reset-email > Logs
   - Deve aparecer: "Email enviado com sucesso"

3. **Verifique o email:**
   - Deve receber o email de reset
   - Link deve funcionar corretamente

## ⚠️ Importante

- **NÃO** ative "Require Authorization" para Send Email Hooks
- A validação já é feita via webhook signature
- Bearer tokens não são necessários para este tipo de hook

## 🔗 Referências

- [Supabase Auth Hooks Documentation](https://supabase.com/docs/guides/auth/auth-hooks)
- Edge Function: `supabase/functions/send-password-reset-email/index.ts`

