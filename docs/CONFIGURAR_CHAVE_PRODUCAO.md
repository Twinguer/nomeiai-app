# 🔐 Configurar Chave de Ofuscação em Produção

## 📋 Resumo

Este documento contém instruções passo a passo para configurar a chave de ofuscação (`VITE_OBFUSCATION_KEY`) no servidor de produção.

**IMPORTANTE**: O banco de dados é compartilhado entre desenvolvimento e produção. A chave no banco já deve estar configurada. Você só precisa configurar a variável de ambiente no servidor.

---

## 🎯 Objetivo

Configurar a variável de ambiente `VITE_OBFUSCATION_KEY` no servidor de produção com o mesmo valor usado em desenvolvimento.

---

## 📝 Passo a Passo

### 1️⃣ Obter a Chave Atual

Execute no terminal local (desenvolvimento):

```bash
npm run config:obfuscation-key
```

Ou manualmente, leia o valor de `VITE_OBFUSCATION_KEY` do arquivo `.env.local`.

**Exemplo de saída:**
```
VITE_OBFUSCATION_KEY=642e8eff5f3e77b5997acfb6d5ff96ad086f1c91d073855544cdacc208e3f211
```

### 2️⃣ Verificar se a Chave Está no Banco

Execute no Supabase SQL Editor:

```sql
SELECT get_obfuscation_key_status() as status;
```

**Resultado esperado:**
- `source`: `app_config` ou `environment_variable`
- `is_production_ready`: `true`
- `key_length`: `64` (ou similar)

Se não estiver configurada, execute:

```sql
DO $$
DECLARE
  v_chave TEXT := 'SUA_CHAVE_AQUI'; -- Substitua pela chave do passo 1
BEGIN
  PERFORM update_obfuscation_key(v_chave);
  RAISE NOTICE '✅ Chave configurada!';
END $$;
```

### 3️⃣ Configurar no Servidor de Produção

#### Opção A: Vercel

1. Acesse: https://vercel.com/dashboard
2. Selecione seu projeto
3. Vá em **Settings** > **Environment Variables**
4. Clique em **Add New**
5. Configure:
   - **Name**: `VITE_OBFUSCATION_KEY`
   - **Value**: (cole a chave do passo 1)
   - **Environments**: Marque **Production** (e **Preview** se necessário)
6. Clique em **Save**
7. **Redeploy** o projeto (Settings > Deployments > Redeploy)

#### Opção B: Netlify

1. Acesse: https://app.netlify.com
2. Selecione seu site
3. Vá em **Site configuration** > **Environment variables**
4. Clique em **Add a variable**
5. Configure:
   - **Key**: `VITE_OBFUSCATION_KEY`
   - **Values**: (cole a chave do passo 1)
   - **Scopes**: Marque **Production** (e **Deploy previews** se necessário)
6. Clique em **Save**
7. **Trigger new deploy** (Deploys > Trigger deploy)

#### Opção C: Servidor Próprio (Linux/SSH)

1. Conecte-se ao servidor via SSH
2. Navegue até o diretório do projeto
3. Edite o arquivo `.env` ou `.env.production`:

```bash
nano .env.production
```

4. Adicione ou atualize a linha:

```
VITE_OBFUSCATION_KEY=642e8eff5f3e77b5997acfb6d5ff96ad086f1c91d073855544cdacc208e3f211
```

5. Salve o arquivo (Ctrl+O, Enter, Ctrl+X)
6. Reinicie o serviço:

```bash
# Se usar PM2
pm2 restart all

# Se usar systemd
sudo systemctl restart seu-servico

# Se usar Docker
docker-compose restart
```

#### Opção D: Docker / Docker Compose

1. Edite o arquivo `docker-compose.yml` ou `.env` do Docker
2. Adicione na seção `environment`:

```yaml
services:
  app:
    environment:
      - VITE_OBFUSCATION_KEY=642e8eff5f3e77b5997acfb6d5ff96ad086f1c91d073855544cdacc208e3f211
```

Ou no arquivo `.env`:

```
VITE_OBFUSCATION_KEY=642e8eff5f3e77b5997acfb6d5ff96ad086f1c91d073855544cdacc208e3f211
```

3. Reinicie os containers:

```bash
docker-compose down
docker-compose up -d
```

### 4️⃣ Verificar Configuração

Após configurar, verifique se a variável está disponível:

**No servidor (SSH):**
```bash
echo $VITE_OBFUSCATION_KEY
```

**No código (adicionar temporariamente para debug):**
```javascript
console.log('Chave configurada:', import.meta.env.VITE_OBFUSCATION_KEY ? '✅ Sim' : '❌ Não');
```

### 5️⃣ Testar

1. Acesse uma página protegida (ex: perfil público de usuário)
2. Verifique o console do navegador
3. Se aparecer erro de token, verifique:
   - Se a variável está configurada corretamente
   - Se o servidor foi reiniciado
   - Se a chave no banco corresponde à chave no servidor

---

## 🔍 Troubleshooting

### Erro: "Token inválido ou expirado"

**Causa**: Chave no servidor diferente da chave no banco.

**Solução**:
1. Verifique a chave no banco:
   ```sql
   SELECT SUBSTRING(get_obfuscation_key(), 1, 8) || '...' as chave_preview;
   ```

2. Verifique a chave no servidor:
   ```bash
   echo $VITE_OBFUSCATION_KEY
   ```

3. Certifique-se de que são **exatamente iguais**

### Erro: "Variável de ambiente não encontrada"

**Causa**: Variável não configurada ou nome incorreto.

**Solução**:
- Verifique se o nome é exatamente `VITE_OBFUSCATION_KEY` (case-sensitive)
- Reinicie o servidor após configurar
- Em Vercel/Netlify, certifique-se de que está marcado para **Production**

### Erro: "Chave muito curta"

**Causa**: Chave com menos de 32 caracteres.

**Solução**:
- Use uma chave de pelo menos 32 caracteres (recomendado: 64)
- Gere uma nova chave se necessário:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```

---

## ✅ Checklist Final

- [ ] Chave obtida do `.env.local` (desenvolvimento)
- [ ] Chave configurada no banco via SQL (se necessário)
- [ ] Variável `VITE_OBFUSCATION_KEY` configurada no servidor de produção
- [ ] Servidor reiniciado após configurar
- [ ] Teste de acesso a página protegida funcionando
- [ ] Console do navegador sem erros de token

---

## 📞 Suporte

Se ainda houver problemas:

1. Execute no Supabase SQL Editor:
   ```sql
   SELECT get_obfuscation_key_status() as status;
   ```

2. Execute no servidor:
   ```bash
   echo $VITE_OBFUSCATION_KEY | head -c 8
   ```

3. Compare os primeiros 8 caracteres - devem ser iguais

4. Verifique os logs do servidor para erros relacionados a variáveis de ambiente

---

## 🔒 Segurança

- **NUNCA** commite a chave no código
- **NUNCA** compartilhe a chave em logs públicos
- Use a **mesma chave** em dev e produção (banco compartilhado)
- A chave deve ter **mínimo 32 caracteres** (recomendado: 64)

