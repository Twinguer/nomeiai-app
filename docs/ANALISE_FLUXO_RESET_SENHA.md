# 🔍 Análise Detalhada do Fluxo de Reset de Senha

## 📋 Fluxo Esperado

1. **Usuário solicita reset** → `ForgotPassword.tsx` → `usePasswordReset.requestPasswordReset()`
2. **Email é enviado** → Edge Function `send-password-reset-email`
3. **Usuário clica no link** → URL com token: `https://www.nomeiai.com.br/auth/reset-password#access_token=...&type=recovery`
4. **Supabase processa token** → Dispara eventos `PASSWORD_RECOVERY` e `SIGNED_IN`
5. **Página ResetPassword carrega** → Define flag `is_password_recovery`
6. **useAuth processa eventos** → Verifica flag e não redireciona
7. **Usuário redefine senha** → `usePasswordReset.resetPassword()`

## 🚨 Problemas Identificados

### Problema 1: Race Condition no Roteamento
**Localização:** `src/pages/Auth/Auth.tsx` e `src/App.tsx`

**Descrição:**
- O componente `Auth.tsx` é renderizado para TODAS as rotas `/auth/*`
- Ele verifica se há usuário logado ANTES do `ResetPassword.tsx` definir a flag
- Isso causa redirecionamento prematuro para "/"

**Código Problemático:**
```typescript
// Auth.tsx - linha 22-25
if (user) {
  return <Navigate to="/" />;  // ❌ Redireciona antes da flag ser setada
}
```

**Solução:**
- Verificar a URL ANTES de verificar o usuário
- A flag deve ser setada sincronamente, não em useEffect

### Problema 2: Ordem dos Eventos do Supabase
**Localização:** `src/hooks/useAuth.tsx`

**Descrição:**
- O Supabase pode disparar `SIGNED_IN` antes de `PASSWORD_RECOVERY`
- Se `SIGNED_IN` for processado primeiro, pode causar redirecionamento
- A flag pode não estar setada ainda quando `SIGNED_IN` é processado

**Código Problemático:**
```typescript
// useAuth.tsx - linha 70-86
case 'SIGNED_IN':
  // Verifica flag, mas pode não estar setada ainda
  const isRecovery = localStorage.getItem('is_password_recovery') === 'true';
```

**Solução:**
- Verificar a URL no momento do evento
- Setar flag imediatamente quando detectar recovery na URL

### Problema 3: Flag Setada Muito Tarde
**Localização:** `src/pages/Auth/ResetPassword.tsx`

**Descrição:**
- A flag é setada no `useEffect`, que executa DEPOIS da renderização
- O `Auth.tsx` já foi renderizado e pode ter redirecionado
- Há um delay de 300ms antes de verificar a sessão

**Código Problemático:**
```typescript
// ResetPassword.tsx - linha 25-42
useEffect(() => {
  const checkToken = async () => {
    localStorage.setItem('is_password_recovery', 'true');  // ❌ Muito tarde!
    await new Promise(resolve => setTimeout(resolve, 300));  // ❌ Delay desnecessário
  };
  checkToken();
}, [searchParams]);
```

**Solução:**
- Setar flag ANTES do componente renderizar
- Usar verificação síncrona da URL

## ✅ Soluções Propostas

### Solução 1: Verificar URL no Auth.tsx
Modificar `Auth.tsx` para verificar a URL ANTES de verificar o usuário.

### Solução 2: Setar Flag Sincronamente
Modificar `ResetPassword.tsx` para setar a flag de forma síncrona, antes do useEffect.

### Solução 3: Melhorar Detecção no useAuth
Modificar `useAuth.tsx` para verificar a URL quando receber eventos de autenticação.

### Solução 4: Usar Query Params para Detecção
Adicionar parâmetro na URL para identificar recovery antes do processamento do token.

## 🔧 Implementação das Correções

