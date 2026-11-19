# Configurar Send Email Hook para Reset de Senha - Passo a Passo Visual

## 🎯 Objetivo
Configurar o "Send Email hook" no Supabase Dashboard para usar o template customizado de reset de senha.

## 📋 Passo a Passo Detalhado

### 1. Acessar Auth Hooks
1. No Supabase Dashboard, vá para **Authentication** > **Hooks**
2. Você verá a tela "Auth Hooks" com o botão **"Add a new hook"**

### 2. Adicionar Send Email Hook
1. Clique no botão **"Add a new hook"** (botão verde no canto superior direito)
2. No dropdown, selecione **"Send Email hook"**

### 3. Configurar o Hook
Preencha os campos:

- **Hook Name**: `send-password-reset-email` (ou qualquer nome descritivo)
- **Hook URL**: 
  ```
  https://ppsymqrdtjyaguftracc.supabase.co/functions/v1/send-password-reset-email
  ```
- **HTTP Method**: `POST` (já deve estar selecionado)
- **HTTP Headers**: Adicione o header de autenticação:
  ```
  Content-Type: application/json
  ```
  (O Supabase adiciona automaticamente o secret via webhook signature)

### 4. Configurar o Secret (Importante!)
O Supabase envia um secret no header para validar o webhook. Você precisa:

1. **Encontrar o Secret atual:**
   - Vá para **Edge Functions** > **send-confirmation-email** > **Settings**
   - Procure pela variável `SEND_EMAIL_HOOK_SECRET`
   - Copie o valor

2. **Configurar no Hook:**
   - No campo "Secret" ou "Webhook Secret" do hook
   - Cole o mesmo valor do `SEND_EMAIL_HOOK_SECRET`
   - **IMPORTANTE**: Use o mesmo secret da função de confirmação para manter consistência

### 5. Salvar e Ativar
1. Clique em **"Save"** ou **"Create Hook"**
2. O hook deve aparecer na lista de hooks ativos
3. Certifique-se de que está **ativado** (toggle ou switch deve estar ligado)

## ✅ Como Funciona

O "Send Email hook" intercepta **todos** os emails de autenticação do Supabase, incluindo:
- ✅ Password recovery (reset de senha)
- ✅ Email confirmation
- ✅ Magic link
- ✅ Outros emails de auth

A Edge Function `send-password-reset-email` verifica o `email_action_type` e só processa emails de tipo `recovery`, ignorando os outros.

## 🔍 Verificar se Está Funcionando

### 1. Testar o Reset de Senha
1. Acesse a página de "Esqueci minha senha"
2. Digite um email cadastrado
3. Solicite o reset

### 2. Verificar os Logs
1. Vá para **Edge Functions** > **send-password-reset-email** > **Logs**
2. Deve aparecer uma requisição POST quando você solicitar o reset
3. Verifique se não há erros nos logs

### 3. Verificar o Email Recebido
- ✅ Email deve ter design customizado (não mostrar `{{ .ConfirmationURL }}`)
- ✅ Link deve apontar para `https://www.nomeiai.com.br/auth/reset-password`
- ✅ Assunto: "Redefina sua senha no Nomeia Aí"

## ⚠️ Problemas Comuns

### Problema: Email ainda mostra template padrão
**Solução:**
- Verifique se o hook está **ativado**
- Verifique se a URL está correta (sem espaços, com https://)
- Verifique se o secret está correto
- Aguarde alguns minutos para o Supabase processar

### Problema: Erro 401 nos logs
**Solução:**
- Verifique se o `SEND_EMAIL_HOOK_SECRET` está correto
- O secret no hook deve ser **exatamente igual** ao da Edge Function

### Problema: Hook não está sendo chamado
**Solução:**
- Verifique se o hook está na lista de hooks ativos
- Verifique se está usando "Send Email hook" (não "Password Verification Attempt hook" que requer plano pago)
- Tente desabilitar e reabilitar o hook

## 📝 Notas Importantes

1. **O "Send Email hook" intercepta TODOS os emails de auth**, então a Edge Function precisa verificar o `email_action_type` para processar apenas recovery
2. **Use o mesmo secret** da função de confirmação para manter consistência
3. **Pode levar alguns minutos** para o Supabase processar a configuração
4. **Teste sempre após configurar** para garantir que está funcionando

## 🔗 Referências

- Edge Function: `supabase/functions/send-password-reset-email/index.ts`
- Template: `supabase/functions/send-password-reset-email/_templates/password-reset-email.tsx`
- Função de confirmação (para referência do secret): `supabase/functions/send-confirmation-email/index.ts`

