# 🤖 Instruções para IA Configurar Chave em Produção

## 🎯 Objetivo

Configurar a variável de ambiente `VITE_OBFUSCATION_KEY` no servidor de produção.

## 📋 Passo a Passo Automatizado

### 1. Executar Script Local

```bash
npm run setup:production-key
```

Este comando irá:
- Ler a chave do `.env.local`
- Mostrar instruções claras
- Gerar SQL para o banco (se necessário)

### 2. Obter a Chave

O script mostrará a chave completa. Copie o valor exibido.

**Exemplo:**
```
VITE_OBFUSCATION_KEY=642e8eff5f3e77b5997acfb6d5ff96ad086f1c91d073855544cdacc208e3f211
```

### 3. Configurar no Servidor

#### Se for Vercel:
1. Acesse: https://vercel.com/dashboard
2. Projeto > Settings > Environment Variables
3. Add New:
   - Name: `VITE_OBFUSCATION_KEY`
   - Value: (cole a chave do passo 2)
   - Environments: ✅ Production
4. Save
5. Redeploy

#### Se for Netlify:
1. Acesse: https://app.netlify.com
2. Site > Site configuration > Environment variables
3. Add a variable:
   - Key: `VITE_OBFUSCATION_KEY`
   - Values: (cole a chave do passo 2)
   - Scopes: ✅ Production
4. Save
5. Trigger new deploy

#### Se for Servidor Próprio (SSH):
```bash
# 1. Conectar ao servidor
ssh usuario@servidor

# 2. Navegar ao projeto
cd /caminho/do/projeto

# 3. Editar .env.production
nano .env.production

# 4. Adicionar linha (substitua pela chave real):
VITE_OBFUSCATION_KEY=642e8eff5f3e77b5997acfb6d5ff96ad086f1c91d073855544cdacc208e3f211

# 5. Salvar (Ctrl+O, Enter, Ctrl+X)

# 6. Reiniciar serviço
pm2 restart all
# OU
sudo systemctl restart seu-servico
# OU
docker-compose restart
```

#### Se for Docker:
```bash
# 1. Editar docker-compose.yml ou .env
nano docker-compose.yml

# 2. Adicionar na seção environment:
environment:
  - VITE_OBFUSCATION_KEY=642e8eff5f3e77b5997acfb6d5ff96ad086f1c91d073855544cdacc208e3f211

# 3. Reiniciar
docker-compose down && docker-compose up -d
```

### 4. Verificar

```bash
# No servidor (SSH)
echo $VITE_OBFUSCATION_KEY

# Deve mostrar a chave completa
```

### 5. Testar

1. Acesse uma página protegida (ex: perfil público)
2. Verifique console do navegador
3. Se funcionar: ✅ Configurado corretamente
4. Se erro de token: Verificar se chave está correta

## ⚠️ Importante

- A chave no servidor DEVE ser **exatamente igual** à chave no `.env.local`
- O banco já deve ter a chave configurada (mesmo banco para dev/prod)
- **Sempre reinicie** o servidor após configurar variáveis de ambiente

## 🔍 Troubleshooting Rápido

**Erro: "Token inválido"**
- Verificar se variável está configurada: `echo $VITE_OBFUSCATION_KEY`
- Verificar se servidor foi reiniciado
- Comparar chave do servidor com chave do banco (devem ser iguais)

**Variável não encontrada**
- Verificar nome: deve ser exatamente `VITE_OBFUSCATION_KEY` (case-sensitive)
- Verificar se está marcado para ambiente Production
- Reiniciar servidor

## ✅ Checklist

- [ ] Script executado: `npm run setup:production-key`
- [ ] Chave copiada
- [ ] Variável configurada no servidor
- [ ] Servidor reiniciado
- [ ] Teste de acesso funcionando

