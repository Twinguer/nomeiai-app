# ⚡ Deploy Rápido - Produção VPS

## 🎯 Resumo Rápido

Guia rápido para aplicar mudanças de ofuscação no servidor de produção.

## 📋 Comandos Rápidos (Copiar e Colar)

```bash
# 1. Conectar ao servidor
ssh root@seu-servidor.com

# 2. Ir para o diretório do projeto
cd /var/www/nomeiai/convoca-ai

# 3. Fazer backup
cp -r dist dist.backup.$(date +%Y%m%d_%H%M%S) 2>/dev/null || true
cp .env .env.backup.$(date +%Y%m%d_%H%M%S) 2>/dev/null || true

# 4. Atualizar código
git pull origin main

# 5. Gerar chaves de ofuscação (copie as 4 chaves geradas)
node -e "const c=require('crypto'); console.log('VITE_URL_OBFUSCATION_KEY='+c.randomBytes(32).toString('hex')); console.log('VITE_OBFUSCATION_KEY='+c.randomBytes(32).toString('hex')); console.log('VITE_ADMIN_OBFUSCATION_KEY='+c.randomBytes(32).toString('hex')); console.log('VITE_COMMUNITY_OBFUSCATION_KEY='+c.randomBytes(32).toString('hex'));"

# 6. Editar .env e adicionar as chaves geradas
nano .env

# Adicione estas linhas (use as chaves geradas no passo 5):
# VITE_URL_OBFUSCATION_KEY=chave-gerada-aqui
# VITE_OBFUSCATION_KEY=chave-gerada-aqui
# VITE_ADMIN_OBFUSCATION_KEY=chave-gerada-aqui
# VITE_COMMUNITY_OBFUSCATION_KEY=chave-gerada-aqui

# 7. Proteger .env
chmod 600 .env

# 8. Instalar dependências (se necessário)
npm install

# 9. Fazer build
npm run build

# 10. Reiniciar servidor web
# Opção A - Nginx:
sudo systemctl reload nginx

# Opção B - PM2:
pm2 restart convoca-ai

# Opção C - systemd:
sudo systemctl restart convoca-ai
```

## ✅ Verificação Rápida

```bash
# Verificar se as variáveis estão no .env
grep OBFUSCATION .env

# Verificar se o build foi criado
ls -lh dist/

# Verificar logs (se usar PM2)
pm2 logs convoca-ai --lines 50
```

## 🧪 Testar no Navegador

1. Acesse o site em produção
2. Abra o Console (F12)
3. **NÃO deve haver erros** sobre variáveis não configuradas
4. Teste:
   - Clicar em perfil de usuário (URL deve ser ofuscada)
   - Acessar ranking (URL deve ser ofuscada)
   - Modo Coach (deve acessar alunos)

## 🆘 Problemas Comuns

### Erro: "VITE_OBFUSCATION_KEY não configurada"
**Solução**: Verifique se o `.env` tem todas as 4 chaves e refaça o build

### URLs não funcionam
**Solução**: 
1. Verifique se as chaves estão corretas no `.env`
2. Faça novo build: `npm run build`
3. Reinicie o servidor

### Build falha
**Solução**: 
```bash
rm -rf node_modules package-lock.json
npm install
npm run build
```

## 📚 Documentação Completa

Para mais detalhes, consulte: `docs/DEPLOY_PRODUCTION.md`

