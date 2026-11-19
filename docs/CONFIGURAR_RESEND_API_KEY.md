# 🔑 Como Configurar RESEND_API_KEY

## 📋 O que é RESEND_API_KEY?

A `RESEND_API_KEY` é a chave de API do Resend necessária para enviar emails através da Edge Function `send-password-reset-email`.

## 🎯 Onde Obter a Chave

### 1. Acessar o Resend Dashboard
1. Acesse: https://resend.com/api-keys
2. Faça login na sua conta Resend
3. Se não tiver conta, crie uma em: https://resend.com/signup

### 2. Criar/Obter API Key
1. No dashboard do Resend, vá para **API Keys**
2. Clique em **"Create API Key"** (se não tiver uma)
3. Dê um nome descritivo (ex: "Nomeia Aí - Supabase")
4. Selecione as permissões necessárias (geralmente "Full Access" para produção)
5. Clique em **"Add"**
6. **IMPORTANTE**: Copie a chave imediatamente (ela só aparece uma vez!)
   - Formato: `re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

## ⚙️ Como Configurar no Supabase

### Opção 1: Via Dashboard (Recomendado)

1. **Acesse o Supabase Dashboard:**
   - https://supabase.com/dashboard/project/ppsymqrdtjyaguftracc

2. **Navegue até Edge Functions:**
   - Menu lateral > **Edge Functions**
   - Clique em **send-password-reset-email**

3. **Acesse Settings:**
   - Clique na aba **"Settings"** ou procure por **"Secrets"** / **"Environment Variables"**

4. **Adicionar/Editar RESEND_API_KEY:**
   - Procure por `RESEND_API_KEY` na lista
   - Se não existir, clique em **"Add Secret"** ou **"Add Environment Variable"**
   - **Name**: `RESEND_API_KEY`
   - **Value**: Cole a chave do Resend (formato: `re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`)
   - Clique em **"Save"** ou **"Add"**

5. **Repetir para send-confirmation-email:**
   - Vá para **Edge Functions** > **send-confirmation-email** > **Settings**
   - Adicione a mesma `RESEND_API_KEY`

### Opção 2: Via CLI (Se tiver acesso)

```bash
# Fazer login no Supabase CLI
npx supabase login

# Linkar ao projeto
npx supabase link --project-ref ppsymqrdtjyaguftracc

# Configurar secret
npx supabase secrets set RESEND_API_KEY=re_sua_chave_aqui --project-ref ppsymqrdtjyaguftracc
```

## ✅ Verificar se Está Configurada

### 1. Via Dashboard
- **Edge Functions** > **send-password-reset-email** > **Settings**
- Verifique se `RESEND_API_KEY` aparece na lista
- O valor deve estar mascarado (mostra apenas alguns caracteres)

### 2. Via Logs
- Solicite um reset de senha
- Vá para **Edge Functions** > **send-password-reset-email** > **Logs**
- Se a chave não estiver configurada, verá:
  ```
  RESEND_API_KEY não está configurada na inicialização
  ```
- Se estiver configurada mas inválida, verá:
  ```
  Erro ao enviar email: API key is invalid
  ```

## 🔍 Troubleshooting

### Problema: "API key is invalid"
**Solução:**
1. Verifique se copiou a chave completa
2. Verifique se não há espaços antes/depois
3. Verifique se a chave não expirou
4. Crie uma nova chave no Resend se necessário

### Problema: "RESEND_API_KEY não configurada"
**Solução:**
1. Verifique se adicionou no Settings da Edge Function
2. Verifique se o nome está exatamente: `RESEND_API_KEY` (case-sensitive)
3. Tente remover e adicionar novamente

### Problema: Email não é enviado
**Solução:**
1. Verifique os logs da Edge Function
2. Verifique se a chave está válida no Resend Dashboard
3. Verifique se o domínio está verificado no Resend (para produção)

## 📝 Variáveis de Ambiente Necessárias

Para a função `send-password-reset-email` funcionar, você precisa de:

1. ✅ `RESEND_API_KEY` - Chave da API do Resend (formato: `re_...`)
2. ✅ `SEND_EMAIL_HOOK_SECRET` - Secret do webhook (formato: `v1,whsec_...`)
3. ✅ `SUPABASE_URL` - `https://ppsymqrdtjyaguftracc.supabase.co`
4. ✅ `SITE_URL` - `https://www.nomeiai.com.br`

## 🔗 Links Úteis

- Resend Dashboard: https://resend.com/api-keys
- Supabase Dashboard: https://supabase.com/dashboard/project/ppsymqrdtjyaguftracc/functions
- Documentação Resend: https://resend.com/docs

