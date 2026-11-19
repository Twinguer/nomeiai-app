#!/bin/bash

# Script para preparar Edge Functions para deploy
# Este script copia os arquivos atualizados e cria um resumo para deploy manual

set -e

PROJECT_DIR="/var/www/nomeiai/convoca-ai"
FUNCTIONS_DIR="$PROJECT_DIR/supabase/functions"
DEPLOY_DIR="$PROJECT_DIR/deploy-edge-functions"

echo "🚀 Preparando Edge Functions para deploy..."
echo ""

# Criar diretório temporário
mkdir -p "$DEPLOY_DIR"

# Lista de funções que precisam de deploy
FUNCTIONS=(
  "create-checkout"
  "verify-stripe-subscription"
  "stripe-webhook"
)

# Copiar arquivos e criar resumo
for func in "${FUNCTIONS[@]}"; do
  FUNC_PATH="$FUNCTIONS_DIR/$func/index.ts"
  
  if [ -f "$FUNC_PATH" ]; then
    echo "✅ Preparando: $func"
    
    # Copiar arquivo
    mkdir -p "$DEPLOY_DIR/$func"
    cp "$FUNC_PATH" "$DEPLOY_DIR/$func/index.ts"
    
    # Contar linhas
    LINES=$(wc -l < "$FUNC_PATH")
    echo "   📄 $LINES linhas"
  else
    echo "❌ Arquivo não encontrado: $FUNC_PATH"
  fi
done

# Criar arquivo de instruções
cat > "$DEPLOY_DIR/INSTRUCOES_DEPLOY.md" << 'EOF'
# 🚀 Instruções para Deploy das Edge Functions

## ⚠️ IMPORTANTE
As Edge Functions precisam ser atualizadas no Supabase Dashboard para corrigir o erro:
```
Price ID não encontrado no Stripe. Price usado: price_1SRah0FBsZSweLR7DI1hiPsv
```

## 📋 Funções que Precisam de Deploy

1. **create-checkout** - CRÍTICO (corrige o erro de Price ID)
2. **verify-stripe-subscription** - Importante
3. **stripe-webhook** - Importante

## 🔧 Passo a Passo

### 1. Acessar o Dashboard
https://supabase.com/dashboard/project/ppsymqrdtjyaguftracc/functions

### 2. Para cada função:

#### a) create-checkout
1. Clique em **"create-checkout"**
2. Clique em **"Code"** (aba lateral)
3. Selecione TODO o conteúdo do editor (Ctrl+A / Cmd+A)
4. Delete o conteúdo
5. Abra o arquivo: `deploy-edge-functions/create-checkout/index.ts`
6. Copie TODO o conteúdo (Ctrl+A / Cmd+A, depois Ctrl+C / Cmd+C)
7. Cole no editor do Supabase (Ctrl+V / Cmd+V)
8. Clique em **"Deploy"** ou **"Save"**
9. Aguarde o deploy completar

#### b) verify-stripe-subscription
Repita os mesmos passos, mas para a função `verify-stripe-subscription`

#### c) stripe-webhook
Repita os mesmos passos, mas para a função `stripe-webhook`

## ✅ Verificação

Após o deploy, teste novamente:
1. Acesse a página de planos
2. Clique em "Assinar" em um plano
3. Verifique se não há mais erro de Price ID

## 🔍 Logs

Para verificar se o deploy funcionou:
- Acesse: Supabase Dashboard → Edge Functions → [nome-da-função] → Logs
- Procure por mensagens de erro ou confirmação de sucesso

## 📝 Nota

Os arquivos estão em: `deploy-edge-functions/[nome-da-função]/index.ts`
EOF

echo ""
echo "✅ Preparação concluída!"
echo ""
echo "📁 Arquivos preparados em: $DEPLOY_DIR"
echo ""
echo "📖 Instruções detalhadas em: $DEPLOY_DIR/INSTRUCOES_DEPLOY.md"
echo ""
echo "🔗 Acesse o Dashboard: https://supabase.com/dashboard/project/ppsymqrdtjyaguftracc/functions"
echo ""


