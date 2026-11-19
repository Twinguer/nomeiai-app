# Configurar Webhook para Reset de Senha

## ⚠️ Problema Identificado

O template padrão do Supabase está sendo usado (`{{ .ConfirmationURL }}`), o que significa que o webhook customizado **não está configurado**. Isso faz com que os emails de reset de senha usem o template padrão do Supabase ao invés do template customizado.

## ✅ Solução

A Edge Function `send-password-reset-email` já existe e está ativa, mas precisa ser configurada como **Auth Hook** no Supabase Dashboard.

## 📋 Passo a Passo Detalhado

### 1. Acessar o Supabase Dashboard
1. Vá para: https://supabase.com/dashboard/project/ppsymqrdtjyaguftracc
2. Faça login se necessário

### 2. Configurar Auth Hook (Método Correto)

O Supabase usa **Auth Hooks** para interceptar emails de autenticação. Siga estes passos:

1. **Navegue até Authentication > Hooks**
   - No menu lateral, clique em **"Authentication"**
   - Depois clique em **"Hooks"** (ou procure por "Email Templates" ou "Webhooks")

2. **Criar/Editar Hook para Password Recovery**
   - Procure por uma seção chamada **"Password Recovery"** ou **"Recovery Email"**
   - Se não existir, clique em **"Add Hook"** ou **"Create Hook"**
   - Se existir, clique para editar

3. **Configurar o Hook**
   - **Hook Type**: Selecione **"Password Recovery"** ou **"Recovery"**
   - **Hook URL**: Cole a URL da Edge Function:
     ```
     https://ppsymqrdtjyaguftracc.supabase.co/functions/v1/send-password-reset-email
     ```
   - **HTTP Method**: `POST`
   - **Secret**: Use o mesmo `SEND_EMAIL_HOOK_SECRET` que está configurado na função de confirmação
     - Você pode encontrar esse secret nas variáveis de ambiente da Edge Function `send-confirmation-email`

4. **Salvar a Configuração**
   - Clique em **"Save"** ou **"Update"**

### 3. Verificar Configuração de Email Templates (Alternativa)

Se não encontrar a opção de Hooks, tente:

1. **Authentication > Email Templates**
2. Procure por **"Reset Password"** ou **"Password Recovery"**
3. Verifique se há uma opção para **"Use Custom Hook"** ou **"Custom URL"**
4. Configure a URL da Edge Function lá

### 4. Verificar Variáveis de Ambiente da Edge Function

Certifique-se de que as seguintes variáveis estão configuradas na Edge Function `send-password-reset-email`:

1. Vá para **Edge Functions** > **send-password-reset-email**
2. Clique em **"Settings"** ou **"Environment Variables"**
3. Verifique se estas variáveis existem:
   - `RESEND_API_KEY`: Chave da API do Resend
   - `SEND_EMAIL_HOOK_SECRET`: Secret para validar o webhook (deve ser o mesmo usado em `send-confirmation-email`)
   - `SUPABASE_URL`: `https://ppsymqrdtjyaguftracc.supabase.co`
   - `SITE_URL`: `https://www.nomeiai.com.br`

### 5. Verificar se o Hook está Funcionando

Após configurar:

1. **Teste o fluxo de reset de senha:**
   - Acesse a página de "Esqueci minha senha"
   - Digite um email cadastrado
   - Solicite o reset

2. **Verifique os logs:**
   - Vá para **Edge Functions** > **send-password-reset-email** > **Logs**
   - Deve aparecer logs de requisições POST quando o reset for solicitado

3. **Verifique o email recebido:**
   - O email deve ter o template customizado (com logo, cores, etc.)
   - O link deve apontar para `/auth/reset-password`

## 🔍 Como Verificar se Está Funcionando

### ✅ Funcionando Corretamente:
- Email recebido tem design customizado (não o template padrão do Supabase)
- Link no email aponta para `https://www.nomeiai.com.br/auth/reset-password`
- Logs da Edge Function mostram requisições POST

### ❌ Ainda com Problemas:
- Email recebido mostra `{{ .ConfirmationURL }}` (template padrão)
- Link no email aponta para URL do Supabase
- Nenhum log na Edge Function

## 📝 Notas Importantes

1. **O webhook deve ser configurado como Auth Hook**, não como Database Webhook
2. **O secret deve ser o mesmo** usado em `send-confirmation-email` para manter consistência
3. **Após configurar, pode levar alguns minutos** para o Supabase processar a mudança
4. **Teste sempre após configurar** para garantir que está funcionando

## 🆘 Se Ainda Não Funcionar

1. Verifique se a Edge Function está **ativa** (status: ACTIVE)
2. Verifique se todas as **variáveis de ambiente** estão configuradas
3. Verifique os **logs da Edge Function** para erros
4. Verifique se o **SEND_EMAIL_HOOK_SECRET** está correto
5. Tente **desabilitar e reabilitar** o hook no dashboard

## 🔗 Referências

- [Supabase Auth Hooks Documentation](https://supabase.com/docs/guides/auth/auth-hooks)
- Edge Function: `supabase/functions/send-password-reset-email/index.ts`
- Template: `supabase/functions/send-password-reset-email/_templates/password-reset-email.tsx`
