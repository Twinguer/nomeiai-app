# 🚀 Deploy das Edge Functions - Guia Rápido

## ⚠️ Importante
O deploy de Edge Functions do Supabase **deve ser feito via Dashboard** pois requer autenticação e configuração de variáveis de ambiente.

## 📋 Funções que Precisam de Deploy

### 1. send-password-reset-email (CRÍTICO)
**Arquivo:** `supabase/functions/send-password-reset-email/index.ts`

**Passos:**
1. Acesse: https://supabase.com/dashboard/project/ppsymqrdtjyaguftracc/functions/send-password-reset-email
2. Clique em **"Code"** (aba)
3. **Copie TODO o conteúdo** do arquivo local `supabase/functions/send-password-reset-email/index.ts`
4. **Cole** no editor do Dashboard (substitua todo o conteúdo)
5. Clique em **"Deploy"** ou **"Save"**
6. Aguarde o deploy completar

### 2. send-confirmation-email (Opcional - se também foi modificado)
**Arquivo:** `supabase/functions/send-confirmation-email/index.ts`

**Passos:** Mesmos do acima, mas para a função `send-confirmation-email`

## ✅ Verificações Após Deploy

### Variáveis de Ambiente
Verifique se estão configuradas em **Settings** > **Secrets**:

- `RESEND_API_KEY` - Chave da API do Resend
- `SEND_EMAIL_HOOK_SECRET` - Formato: `v1,whsec_<base64>`
- `SUPABASE_URL` - `https://ppsymqrdtjyaguftracc.supabase.co`
- `SITE_URL` - `https://www.nomeiai.com.br`

### Testar
1. Solicitar reset de senha
2. Verificar logs: **Logs** (aba) > Procurar por erros
3. Verificar se o email é recebido

## 🔍 Verificar Logs

Após o deploy, verifique os logs:
- **Edge Functions** > **send-password-reset-email** > **Logs**
- Procure por:
  - ✅ "Template HTML renderizado com sucesso"
  - ✅ "Email enviado com sucesso"
  - ❌ Qualquer mensagem de erro

## 📝 Nota sobre MCP

Não há ferramentas MCP disponíveis para deploy automático de Edge Functions do Supabase, pois:
- Requer autenticação no Supabase
- Requer configuração de variáveis de ambiente
- Requer acesso ao Dashboard

O método recomendado é via Dashboard conforme descrito acima.

