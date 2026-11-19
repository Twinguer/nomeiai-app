#!/bin/bash

# =====================================================
# Script: Configurar Chave de Ofuscação em Produção
# =====================================================
# 
# Este script ajuda a configurar VITE_OBFUSCATION_KEY
# no servidor de produção
#
# Uso: bash scripts/setup-production-key.sh
# =====================================================

set -e  # Parar em caso de erro

echo "🔐 Configuração de Chave de Ofuscação para Produção"
echo "=================================================="
echo ""

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Verificar se .env.local existe
if [ ! -f ".env.local" ]; then
    echo -e "${RED}❌ Arquivo .env.local não encontrado${NC}"
    echo "   Execute este script na raiz do projeto"
    exit 1
fi

# Extrair chave do .env.local
OBFUSCATION_KEY=$(grep "^VITE_OBFUSCATION_KEY=" .env.local | cut -d '=' -f2 | tr -d '"' | tr -d "'")

if [ -z "$OBFUSCATION_KEY" ]; then
    echo -e "${RED}❌ VITE_OBFUSCATION_KEY não encontrada no .env.local${NC}"
    exit 1
fi

KEY_LENGTH=${#OBFUSCATION_KEY}
KEY_PREVIEW="${OBFUSCATION_KEY:0:8}..."

echo -e "${GREEN}✅ Chave encontrada${NC}"
echo "   Preview: $KEY_PREVIEW"
echo "   Tamanho: $KEY_LENGTH caracteres"
echo ""

if [ $KEY_LENGTH -lt 32 ]; then
    echo -e "${YELLOW}⚠️  Aviso: Chave muito curta (mínimo 32 caracteres recomendado)${NC}"
    echo ""
fi

echo "📋 INSTRUÇÕES PARA CONFIGURAR NO SERVIDOR:"
echo "=========================================="
echo ""
echo "1. Copie o valor abaixo:"
echo ""
echo -e "${GREEN}$OBFUSCATION_KEY${NC}"
echo ""
echo "2. Configure no seu servidor de produção:"
echo ""
echo "   Vercel/Netlify:"
echo "   - Settings > Environment Variables"
echo "   - Name: VITE_OBFUSCATION_KEY"
echo "   - Value: (cole a chave acima)"
echo "   - Environments: Production"
echo ""
echo "   Servidor próprio (SSH):"
echo "   - Edite .env ou .env.production"
echo "   - Adicione: VITE_OBFUSCATION_KEY=$OBFUSCATION_KEY"
echo "   - Reinicie o serviço"
echo ""
echo "   Docker:"
echo "   - Edite docker-compose.yml ou .env"
echo "   - Adicione na seção environment"
echo "   - Reinicie: docker-compose restart"
echo ""
echo "3. Verifique se está configurada:"
echo "   echo \$VITE_OBFUSCATION_KEY"
echo ""
echo "4. Reinicie o servidor após configurar"
echo ""
echo "=========================================="
echo ""

# Gerar SQL para banco (se necessário)
echo "📝 SQL para configurar no banco (se ainda não estiver):"
echo "=========================================="
echo ""
echo "Execute no Supabase SQL Editor:"
echo ""
echo "DO \$\$"
echo "DECLARE"
echo "  v_chave TEXT := '$OBFUSCATION_KEY';"
echo "BEGIN"
echo "  PERFORM update_obfuscation_key(v_chave);"
echo "  RAISE NOTICE '✅ Chave configurada!';"
echo "END \$\$;"
echo ""
echo "-- Verificar"
echo "SELECT get_obfuscation_key_status() as status;"
echo ""

