# 🔧 Troubleshooting: Problema de Login

## Problema
Não é possível fazer login com nenhum usuário após mover as chaves Supabase para variáveis de ambiente.

## Possíveis Causas

### 1. Variáveis de Ambiente Não Carregadas
O Vite precisa ser **reiniciado** após alterar o arquivo `.env.local`.

**Solução:**
```bash
# Parar o servidor (Ctrl+C)
# Reiniciar o servidor
npm run dev
```

### 2. URL/Chave do Supabase Incorreta
O `.env.local` pode ter uma URL/chave diferente do projeto correto.

**Verificação:**
1. Abra o arquivo `.env.local`
2. Verifique se `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` estão corretas
3. Compare com as credenciais no Dashboard do Supabase

**Solução:**
1. Acesse [Supabase Dashboard](https://supabase.com/dashboard)
2. Selecione seu projeto
3. Vá em **Settings** > **API**
4. Copie:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon/public key** → `VITE_SUPABASE_ANON_KEY`
5. Atualize o `.env.local`
6. **Reinicie o servidor**

### 3. Cliente Supabase Não Inicializado
O cliente pode estar sendo criado com valores vazios.

**Verificação:**
1. Abra o console do navegador (F12)
2. Procure por erros relacionados a Supabase
3. Verifique se há mensagens sobre variáveis não configuradas

**Solução:**
- Verifique os logs no console
- Certifique-se de que as variáveis estão sendo carregadas

## Passos para Resolver

### Passo 1: Verificar Arquivo .env.local
```bash
# Verificar se o arquivo existe
ls -la .env.local

# Verificar conteúdo (sem expor chaves completas)
cat .env.local | grep VITE_SUPABASE
```

### Passo 2: Verificar Variáveis no Código
Abra o console do navegador e verifique:
- Não deve haver erros sobre "VITE_SUPABASE_URL não configurada"
- Não deve haver erros sobre "VITE_SUPABASE_ANON_KEY não configurada"

### Passo 3: Reiniciar Servidor
```bash
# Parar servidor atual
# Pressione Ctrl+C

# Limpar cache (opcional)
rm -rf node_modules/.vite

# Reiniciar servidor
npm run dev
```

### Passo 4: Testar Login
1. Abra o navegador em modo anônimo/privado
2. Acesse a página de login
3. Tente fazer login
4. Verifique o console do navegador para erros

## Debug Adicional

### Verificar se Cliente Supabase está Configurado
No console do navegador, execute:
```javascript
// Verificar se o cliente está disponível
console.log(window.supabase || 'Cliente não encontrado');

// Verificar variáveis de ambiente (apenas em dev)
console.log(import.meta.env.VITE_SUPABASE_URL ? 'URL configurada' : 'URL NÃO configurada');
console.log(import.meta.env.VITE_SUPABASE_ANON_KEY ? 'Key configurada' : 'Key NÃO configurada');
```

### Verificar Erros de Autenticação
No console do navegador, procure por:
- Erros de rede (CORS, 401, 403)
- Erros de autenticação do Supabase
- Mensagens sobre sessão inválida

## Solução Rápida

Se nada funcionar, use o fallback temporário:

1. **NÃO RECOMENDADO PARA PRODUÇÃO**
2. Comente as validações em `src/integrations/supabase/client.ts`
3. Use os valores hardcoded temporariamente
4. **IMPORTANTE**: Reverta antes de fazer deploy

## Contato

Se o problema persistir:
1. Verifique os logs do console do navegador
2. Verifique os logs do servidor de desenvolvimento
3. Verifique se o projeto Supabase está ativo
4. Verifique se as credenciais estão corretas


