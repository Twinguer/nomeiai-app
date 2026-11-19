# 🚀 Guia de Deploy em Produção (VPS)

Este guia descreve passo a passo como aplicar todas as mudanças, especialmente as de ofuscação de URLs, no servidor de produção.

## 📋 Pré-requisitos

- Acesso SSH ao servidor VPS
- Permissões para executar comandos no servidor
- Node.js e npm instalados no servidor
- Servidor web configurado (Nginx, Apache, etc.)

## 🔐 Passo 1: Conectar ao Servidor

```bash
ssh usuario@seu-servidor.com
# ou
ssh root@seu-servidor.com
```

## 📁 Passo 2: Navegar até o Diretório do Projeto

```bash
cd /var/www/nomeiai/convoca-ai
# ou o caminho onde está o projeto
```

## 🔄 Passo 3: Fazer Backup do Estado Atual

```bash
# Criar backup do build atual (se existir)
if [ -d "dist" ]; then
  cp -r dist dist.backup.$(date +%Y%m%d_%H%M%S)
fi

# Criar backup do .env atual (se existir)
if [ -f ".env" ]; then
  cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
fi
```

## 📥 Passo 4: Atualizar o Código do Repositório

```bash
# Verificar status atual
git status

# Fazer pull das mudanças mais recentes
git pull origin main

# Verificar se há conflitos
git status
```

## 🔑 Passo 5: Configurar Variáveis de Ambiente

### 5.1. Gerar Chaves de Ofuscação (no servidor)

```bash
# Gerar todas as 4 chaves de uma vez
node -e "const c=require('crypto'); console.log('VITE_URL_OBFUSCATION_KEY='+c.randomBytes(32).toString('hex')); console.log('VITE_OBFUSCATION_KEY='+c.randomBytes(32).toString('hex')); console.log('VITE_ADMIN_OBFUSCATION_KEY='+c.randomBytes(32).toString('hex')); console.log('VITE_COMMUNITY_OBFUSCATION_KEY='+c.randomBytes(32).toString('hex'));"
```

**IMPORTANTE**: Copie todas as 4 chaves geradas. Você precisará delas no próximo passo.

### 5.2. Criar/Editar Arquivo .env

```bash
# Criar ou editar o arquivo .env
nano .env
# ou
vi .env
```

### 5.3. Adicionar Todas as Variáveis

Adicione todas as variáveis necessárias no arquivo `.env`:

```env
# Supabase (PRODUÇÃO)
VITE_SUPABASE_URL=https://ppsymqrdtjyaguftracc.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon-producao

# Chaves de Ofuscação (PRODUÇÃO - use as chaves geradas no passo 5.1)
VITE_URL_OBFUSCATION_KEY=chave-producao-64-caracteres-gerada
VITE_OBFUSCATION_KEY=chave-producao-64-caracteres-gerada
VITE_ADMIN_OBFUSCATION_KEY=chave-producao-64-caracteres-gerada
VITE_COMMUNITY_OBFUSCATION_KEY=chave-producao-64-caracteres-gerada
```

**IMPORTANTE**: 
- Use chaves DIFERENTES das de desenvolvimento
- Cada chave deve ter 64 caracteres (32 bytes em hexadecimal)
- Não compartilhe essas chaves publicamente

### 5.4. Configurar Permissões do Arquivo .env

```bash
# Proteger o arquivo .env
chmod 600 .env

# Verificar se está protegido
ls -la .env
# Deve mostrar: -rw------- (apenas o dono pode ler/escrever)
```

## 📦 Passo 6: Instalar Dependências (se necessário)

```bash
# Se houver novas dependências, instalar
npm install

# Verificar se não há erros
npm list --depth=0
```

## 🏗️ Passo 7: Fazer Build da Aplicação

```bash
# Fazer build de produção
npm run build

# Verificar se o build foi bem-sucedido
ls -la dist/
# Deve mostrar os arquivos compilados
```

**Tempo estimado**: 2-5 minutos dependendo do servidor

## ✅ Passo 8: Verificar o Build

```bash
# Verificar se os arquivos foram gerados
ls -lh dist/

# Verificar se há erros no build
# (o comando acima deve mostrar os arquivos sem erros)
```

## 🔄 Passo 9: Reiniciar o Servidor Web

### Opção A: Se usar Nginx + Build Estático

```bash
# Copiar arquivos para o diretório do Nginx (se necessário)
# Normalmente o Nginx já aponta para o diretório dist/

# Recarregar configuração do Nginx
sudo nginx -t  # Verificar configuração
sudo systemctl reload nginx  # Recarregar sem downtime
# ou
sudo service nginx reload
```

### Opção B: Se usar PM2

```bash
# Reiniciar aplicação PM2
pm2 restart convoca-ai

# Verificar status
pm2 status
pm2 logs convoca-ai --lines 50
```

### Opção C: Se usar systemd

```bash
# Reiniciar serviço
sudo systemctl restart convoca-ai

# Verificar status
sudo systemctl status convoca-ai
```

### Opção D: Se usar Docker

```bash
# Rebuild e restart
docker-compose down
docker-compose up -d --build

# Verificar logs
docker-compose logs -f
```

## 🧪 Passo 10: Verificar se Está Funcionando

### 10.1. Verificar no Navegador

1. Acesse o site em produção
2. Abra o Console do Navegador (F12)
3. Verifique se **NÃO há erros** sobre variáveis não configuradas
4. Teste funcionalidades:
   - Acessar perfil de usuário (deve usar URL ofuscada)
   - Acessar ranking/concurso (deve usar URL ofuscada)
   - Acessar página de cargos (deve funcionar com token)
   - Modo Coach (deve acessar alunos corretamente)

### 10.2. Verificar Logs do Servidor

```bash
# Se usar PM2
pm2 logs convoca-ai --lines 100

# Se usar systemd
sudo journalctl -u convoca-ai -n 100

# Se usar Nginx
sudo tail -f /var/log/nginx/error.log
```

### 10.3. Verificar Variáveis de Ambiente

```bash
# Verificar se as variáveis estão no .env
grep OBFUSCATION .env

# Deve mostrar as 4 chaves configuradas
```

## 🆘 Troubleshooting

### Erro: "VITE_OBFUSCATION_KEY não configurada"

**Causa**: Variável não está no arquivo `.env` ou não foi carregada no build

**Solução**:
1. Verifique se o arquivo `.env` existe e tem as variáveis
2. Certifique-se de fazer `npm run build` DEPOIS de criar o `.env`
3. Verifique se o `.env` está no diretório raiz do projeto

### Erro: URLs ofuscadas não funcionam

**Causa**: Chaves incorretas ou build antigo

**Solução**:
1. Verifique se as chaves no `.env` estão corretas
2. Faça um novo build: `npm run build`
3. Reinicie o servidor web

### Erro: 404 em rotas ofuscadas

**Causa**: Servidor web não está configurado para SPA (Single Page Application)

**Solução**:
Configure o Nginx para redirecionar todas as rotas para `index.html`:

```nginx
location / {
  try_files $uri $uri/ /index.html;
}
```

### Build falha

**Causa**: Dependências desatualizadas ou erros de compilação

**Solução**:
```bash
# Limpar cache e node_modules
rm -rf node_modules package-lock.json
npm install
npm run build
```

## 📝 Checklist de Deploy

- [ ] Conectado ao servidor via SSH
- [ ] Backup criado (dist e .env)
- [ ] Código atualizado (`git pull`)
- [ ] Chaves de ofuscação geradas
- [ ] Arquivo `.env` criado/atualizado com todas as variáveis
- [ ] Permissões do `.env` configuradas (`chmod 600`)
- [ ] Dependências instaladas (`npm install`)
- [ ] Build realizado com sucesso (`npm run build`)
- [ ] Servidor web reiniciado
- [ ] Testado no navegador (sem erros no console)
- [ ] Funcionalidades testadas (perfis, rankings, coach)

## 🔄 Rollback (Se Algo Der Errado)

Se precisar voltar à versão anterior:

```bash
# Restaurar backup do build
if [ -d "dist.backup.*" ]; then
  rm -rf dist
  cp -r dist.backup.* dist
fi

# Restaurar backup do .env
if [ -f ".env.backup.*" ]; then
  cp .env.backup.* .env
fi

# Reiniciar servidor
sudo systemctl reload nginx
# ou
pm2 restart convoca-ai
```

## 📞 Suporte

Se encontrar problemas:
1. Verifique os logs do servidor
2. Verifique o console do navegador
3. Verifique se todas as variáveis estão configuradas
4. Verifique se o build foi bem-sucedido

---

**Última atualização**: 2025-01-19

