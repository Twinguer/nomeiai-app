# 🔐 Configurar Chave de Ofuscação para Produção

## ⚠️ IMPORTANTE

A chave de ofuscação **DEVE** ser configurada no Supabase para que a validação de tokens funcione corretamente.

## 📋 Método Recomendado (Mais Seguro)

### 1. Configurar Variável de Ambiente no Supabase

1. Acesse o **Supabase Dashboard**
2. Vá em **Settings** > **Database**
3. Role até **Custom Config** (ou **Database Settings**)
4. Adicione uma nova configuração:
   - **Key**: `app.obfuscation_key`
   - **Value**: O mesmo valor de `VITE_OBFUSCATION_KEY` do seu `.env.local`

### 2. Verificar Configuração

Execute no SQL Editor do Supabase:

```sql
SELECT get_obfuscation_key_status();
```

Isso mostrará se a chave está configurada corretamente.

## 🔄 Método Alternativo (Backup)

Se não conseguir configurar via Dashboard, use a função SQL:

```sql
-- Substitua 'SUA_CHAVE_AQUI' pelo valor de VITE_OBFUSCATION_KEY
SELECT update_obfuscation_key('SUA_CHAVE_AQUI');
```

**Nota**: Este método armazena na tabela `app_config`, mas a função `get_obfuscation_key()` prioriza a variável de ambiente.

## ✅ Verificação

Após configurar, teste a validação:

```sql
-- Verificar se a função está funcionando
SELECT get_obfuscation_key() as chave_configurada;

-- Status completo
SELECT get_obfuscation_key_status();
```

## 🔍 Debug

Se os tokens ainda não funcionarem:

```sql
-- Debug de um token específico
SELECT debug_validate_user_token('seu_token_aqui');
```

Isso mostrará exatamente onde está falhando:
- Decodificação base64
- Formato do token
- Comparação de chaves
- Expiração
- Existência do usuário

## 📝 Notas de Segurança

1. **Nunca** commite a chave no código
2. Use a **mesma chave** no frontend (`VITE_OBFUSCATION_KEY`) e backend (`app.obfuscation_key`)
3. Em produção, use uma **chave forte** (mínimo 32 caracteres, aleatória)
4. A variável de ambiente do Supabase é **mais segura** que a tabela

## 🚨 Problema Comum

**Erro**: "Token de acesso inválido ou expirado"

**Causa**: Chave do backend diferente da chave do frontend

**Solução**: 
1. Verifique o valor de `VITE_OBFUSCATION_KEY` no `.env.local`
2. Configure o mesmo valor em `app.obfuscation_key` no Supabase
3. Verifique com: `SELECT get_obfuscation_key_status();`

