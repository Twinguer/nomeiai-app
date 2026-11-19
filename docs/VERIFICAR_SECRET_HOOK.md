# 🔍 Verificar Secret do Hook

## ⚠️ Problema Comum

O erro "Hook requires authorization token" ou 500 pode ocorrer se o **secret no hook não corresponder** ao secret na variável de ambiente da Edge Function.

## ✅ Verificação

### 1. Verificar Secret no Hook (Dashboard)

Na tela que você está vendo:
- **Secret**: `v1,whsec_lrYhMXYu/LSUvLQIIqvpicA0X0Uds8SXpCulVLt8YPDLpuityUmXlf/dpQAl13Wvi5AzMyFJTWHbLn/L`

### 2. Verificar Secret na Edge Function

1. Vá para **Edge Functions** > **send-password-reset-email** > **Settings**
2. Procure por `SEND_EMAIL_HOOK_SECRET`
3. O valor deve ser **EXATAMENTE IGUAL** ao secret do hook

### 3. Comparar

O secret no hook deve ser **idêntico** ao `SEND_EMAIL_HOOK_SECRET` na Edge Function.

## 🔧 Se Não Corresponder

### Opção 1: Atualizar Secret na Edge Function

1. **Copie o secret do hook** (da tela atual)
2. Vá para **Edge Functions** > **send-password-reset-email** > **Settings**
3. Edite `SEND_EMAIL_HOOK_SECRET`
4. Cole o mesmo valor do hook
5. Salve

### Opção 2: Atualizar Secret no Hook

1. **Copie o secret da Edge Function**
2. Na tela do hook, cole no campo "Secret"
3. Clique em **"Update hook"**

## 📝 Importante

- O secret deve estar no formato: `v1,whsec_<base64>`
- Deve ser **exatamente igual** em ambos os lugares
- Sem espaços antes/depois
- Case-sensitive

## 🧪 Testar Após Corrigir

1. Solicite reset de senha
2. Verifique logs: **Edge Functions** > **send-password-reset-email** > **Logs**
3. Os logs mostrarão se a verificação do signature está funcionando

