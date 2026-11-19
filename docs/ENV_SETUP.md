# 🔐 Configuração de Variáveis de Ambiente

## 📋 Visão Geral

Este documento descreve como configurar as variáveis de ambiente necessárias para o sistema funcionar corretamente em produção.

## 🚨 CRÍTICO: Variáveis Obrigatórias

As seguintes variáveis são **OBRIGATÓRIAS** e o sistema **NÃO FUNCIONARÁ** sem elas:

1. `VITE_SUPABASE_URL` - URL do projeto Supabase
2. `VITE_SUPABASE_ANON_KEY` - Chave anônima do Supabase
3. `VITE_URL_OBFUSCATION_KEY` - Chave para ofuscar URLs de concursos
4. `VITE_OBFUSCATION_KEY` - Chave para ofuscar URLs de usuários
5. `VITE_ADMIN_OBFUSCATION_KEY` - Chave para ofuscar URLs de admin
6. `VITE_COMMUNITY_OBFUSCATION_KEY` - Chave para ofuscar URLs da comunidade

## 📝 Passo a Passo

### 1. Copiar Arquivo de Exemplo

```bash
cp .env.example .env.local
```

### 2. Obter Credenciais do Supabase

1. Acesse o [Dashboard do Supabase](https://supabase.com/dashboard)
2. Selecione seu projeto
3. Vá em **Settings** > **API**
4. Copie:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon/public key** → `VITE_SUPABASE_ANON_KEY`

### 3. Gerar Chaves de Ofuscação

As chaves de ofuscação devem ser:
- **Mínimo 32 caracteres**
- **Aleatórias e imprevisíveis**
- **Diferentes entre desenvolvimento e produção**

#### Opção 1: Node.js

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

#### Opção 2: OpenSSL (Linux/Mac)

```bash
openssl rand -hex 32
```

#### Opção 3: Online

Use um gerador seguro: https://www.random.org/strings/

### 4. Preencher Arquivo .env.local

Edite o arquivo `.env.local` e preencha todas as variáveis:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon

VITE_URL_OBFUSCATION_KEY=chave-gerada-para-concursos
VITE_OBFUSCATION_KEY=chave-gerada-para-usuarios
VITE_ADMIN_OBFUSCATION_KEY=chave-gerada-para-admin
VITE_COMMUNITY_OBFUSCATION_KEY=chave-gerada-para-comunidade
```

## 🚀 Configuração em Produção

### Vercel / Netlify

1. Acesse o dashboard da plataforma
2. Vá em **Settings** > **Environment Variables**
3. Adicione cada variável manualmente
4. **IMPORTANTE**: Marque como "Production" apenas

### Servidor Próprio

1. Crie arquivo `.env` no diretório raiz do projeto
2. Configure permissões restritivas:
   ```bash
   chmod 600 .env
   ```
3. Adicione ao `.gitignore` (já está configurado)

### Docker

Adicione as variáveis no `docker-compose.yml` ou use um arquivo `.env`:

```yaml
environment:
  - VITE_SUPABASE_URL=${VITE_SUPABASE_URL}
  - VITE_SUPABASE_ANON_KEY=${VITE_SUPABASE_ANON_KEY}
  # ... outras variáveis
```

## ✅ Verificação

Após configurar, verifique se está funcionando:

1. Inicie o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```

2. Verifique o console do navegador - não deve haver erros sobre variáveis não configuradas

3. Teste funcionalidades que usam ofuscação:
   - Acessar perfil de usuário
   - Acessar ranking/concurso
   - Acessar área administrativa

## 🔄 Rotação de Chaves

**Recomendação**: Rotacione as chaves a cada 6 meses ou imediatamente se houver suspeita de comprometimento.

### Processo de Rotação

1. Gere novas chaves
2. Atualize as variáveis de ambiente
3. Reinicie o servidor/aplicação
4. **IMPORTANTE**: URLs antigas ofuscadas deixarão de funcionar

## 🆘 Troubleshooting

### Erro: "VITE_URL_OBFUSCATION_KEY não configurada"

**Causa**: Variável de ambiente não está definida

**Solução**:
1. Verifique se o arquivo `.env.local` existe
2. Verifique se as variáveis estão corretamente nomeadas
3. Reinicie o servidor de desenvolvimento
4. Em produção, verifique as configurações da plataforma

### URLs Ofuscadas Não Funcionam

**Causa**: Chave incorreta ou não configurada

**Solução**:
1. Verifique se a chave está correta
2. Verifique se não há espaços extras na chave
3. Gere uma nova chave e atualize

## 📚 Referências

- [Documentação Vite - Environment Variables](https://vitejs.dev/guide/env-and-mode.html)
- [Supabase - Environment Variables](https://supabase.com/docs/guides/getting-started/local-development#environment-variables)


