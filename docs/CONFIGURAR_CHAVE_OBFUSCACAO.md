# 🔐 Configurar Chave de Ofuscação

## Problema

Após mover a validação de tokens para o backend, é necessário que a chave de ofuscação no backend seja **exatamente a mesma** do frontend (`VITE_OBFUSCATION_KEY`).

## Solução

### Opção 1: Via SQL (Recomendado)

Execute no Supabase SQL Editor:

```sql
-- Substitua 'SUA_CHAVE_AQUI' pelo valor de VITE_OBFUSCATION_KEY do seu .env.local
SELECT update_obfuscation_key('SUA_CHAVE_AQUI');
```

### Opção 2: Via Script Node.js

```bash
node scripts/sync-obfuscation-key.js
```

Este script lê automaticamente a chave do `.env.local` e atualiza no Supabase.

### Opção 3: Via MCP Supabase

Se você tem acesso ao MCP, execute:

```sql
SELECT update_obfuscation_key('sua_chave_do_env_local');
```

## Verificar Configuração

Para verificar se a chave está configurada corretamente:

```sql
SELECT 
  get_obfuscation_key() as chave_atual,
  (SELECT value FROM app_config WHERE key = 'obfuscation_key') as chave_armazenada;
```

## Debug de Tokens

Se os tokens ainda não funcionarem, use a função de debug:

```sql
SELECT debug_validate_user_token('seu_token_aqui');
```

Isso mostrará exatamente onde está falhando a validação.

## Importante

- A chave no backend **DEVE** ser exatamente igual à chave do frontend
- Se `VITE_OBFUSCATION_KEY` não estiver configurada no frontend, ambos usam o fallback de desenvolvimento
- Em produção, **SEMPRE** configure uma chave forte e única

