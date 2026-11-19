#!/bin/bash

# Script de Deploy para Produção
# Uso: ./scripts/deploy-production.sh

set -e  # Parar em caso de erro

echo "🚀 Iniciando deploy em produção..."
echo ""

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Verificar se está no diretório correto
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Erro: Execute este script do diretório raiz do projeto${NC}"
    exit 1
fi

# Passo 1: Backup
echo -e "${YELLOW}📦 Criando backup...${NC}"
if [ -d "dist" ]; then
    BACKUP_NAME="dist.backup.$(date +%Y%m%d_%H%M%S)"
    cp -r dist "$BACKUP_NAME"
    echo -e "${GREEN}✅ Backup criado: $BACKUP_NAME${NC}"
fi

if [ -f ".env" ]; then
    ENV_BACKUP=".env.backup.$(date +%Y%m%d_%H%M%S)"
    cp .env "$ENV_BACKUP"
    echo -e "${GREEN}✅ Backup do .env criado: $ENV_BACKUP${NC}"
fi

# Passo 2: Atualizar código
echo -e "${YELLOW}📥 Atualizando código do repositório...${NC}"
git pull origin main
echo -e "${GREEN}✅ Código atualizado${NC}"

# Passo 3: Verificar .env
echo -e "${YELLOW}🔍 Verificando variáveis de ambiente...${NC}"
if [ ! -f ".env" ]; then
    echo -e "${RED}❌ Arquivo .env não encontrado!${NC}"
    echo -e "${YELLOW}📝 Criando arquivo .env...${NC}"
    touch .env
    chmod 600 .env
    echo -e "${GREEN}✅ Arquivo .env criado. Configure as variáveis antes de continuar.${NC}"
    echo ""
    echo "Execute: nano .env"
    echo "E adicione todas as variáveis necessárias (veja docs/DEPLOY_PRODUCTION.md)"
    exit 1
fi

# Verificar se as chaves de ofuscação estão configuradas
if ! grep -q "VITE_URL_OBFUSCATION_KEY" .env || \
   ! grep -q "VITE_OBFUSCATION_KEY" .env || \
   ! grep -q "VITE_ADMIN_OBFUSCATION_KEY" .env || \
   ! grep -q "VITE_COMMUNITY_OBFUSCATION_KEY" .env; then
    echo -e "${RED}❌ Chaves de ofuscação não encontradas no .env!${NC}"
    echo -e "${YELLOW}💡 Gerando chaves...${NC}"
    echo ""
    
    # Gerar chaves
    KEY1=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
    KEY2=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
    KEY3=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
    KEY4=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
    
    echo "# Chaves de Ofuscação (PRODUÇÃO)" >> .env
    echo "VITE_URL_OBFUSCATION_KEY=$KEY1" >> .env
    echo "VITE_OBFUSCATION_KEY=$KEY2" >> .env
    echo "VITE_ADMIN_OBFUSCATION_KEY=$KEY3" >> .env
    echo "VITE_COMMUNITY_OBFUSCATION_KEY=$KEY4" >> .env
    
    echo -e "${GREEN}✅ Chaves geradas e adicionadas ao .env${NC}"
fi

# Configurar permissões do .env
chmod 600 .env
echo -e "${GREEN}✅ Permissões do .env configuradas${NC}"

# Passo 4: Instalar dependências
echo -e "${YELLOW}📦 Instalando dependências...${NC}"
npm install
echo -e "${GREEN}✅ Dependências instaladas${NC}"

# Passo 5: Build
echo -e "${YELLOW}🏗️  Fazendo build de produção...${NC}"
npm run build

if [ ! -d "dist" ] || [ -z "$(ls -A dist)" ]; then
    echo -e "${RED}❌ Erro: Build falhou ou diretório dist está vazio${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Build concluído com sucesso${NC}"

# Passo 6: Verificar build
echo -e "${YELLOW}🔍 Verificando build...${NC}"
if [ -f "dist/index.html" ]; then
    echo -e "${GREEN}✅ index.html encontrado${NC}"
else
    echo -e "${RED}❌ Erro: index.html não encontrado no build${NC}"
    exit 1
fi

# Passo 7: Reiniciar servidor (opcional - descomente se necessário)
# echo -e "${YELLOW}🔄 Reiniciando servidor...${NC}"
# 
# # Descomente a opção que você usa:
# # sudo systemctl reload nginx
# # pm2 restart convoca-ai
# # sudo systemctl restart convoca-ai
# 
# echo -e "${GREEN}✅ Servidor reiniciado${NC}"

echo ""
echo -e "${GREEN}✅✅✅ Deploy concluído com sucesso! ✅✅✅${NC}"
echo ""
echo "📋 Próximos passos:"
echo "1. Reinicie o servidor web manualmente (Nginx, PM2, etc.)"
echo "2. Teste a aplicação no navegador"
echo "3. Verifique o console do navegador para erros"
echo ""
echo "📚 Para mais informações, consulte: docs/DEPLOY_PRODUCTION.md"

