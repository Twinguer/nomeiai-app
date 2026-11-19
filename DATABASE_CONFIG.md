# 🗄️ Configuração de Bancos de Dados

Este projeto suporta dois bancos de dados diferentes para desenvolvimento e produção.

## 📋 Bancos Disponíveis

### 🧪 **nomeia-ai** (Desenvolvimento)
- **URL**: `https://xuovcuefnullpmpktrzd.supabase.co`
- **Uso**: Ambiente de desenvolvimento e testes
- **Dados**: Replica do banco de produção para testes seguros

### 🚀 **convoca-ai** (Produção)
- **URL**: `https://ppsymqrdtjyaguftracc.supabase.co`
- **Uso**: Ambiente de produção
- **Dados**: Dados reais dos usuários

## 🔧 Como Alternar Entre Bancos

### Método 1: Script Automático (Recomendado)

```bash
# Usar banco nomeia-ai (desenvolvimento)
node switch-database.js nomeia-ai

# Usar banco convoca-ai (produção)
node switch-database.js convoca-ai
```

### Método 2: Manual

```bash
# Para usar nomeia-ai
cp env.nomeia-ai .env.local

# Para usar convoca-ai
cp env.convoca-ai .env.local
```

## 📁 Arquivos de Configuração

| Arquivo | Descrição |
|---------|-----------|
| `env.nomeia-ai` | Configuração para banco de desenvolvimento |
| `env.convoca-ai` | Configuração para banco de produção |
| `.env.local` | Arquivo ativo (criado automaticamente) |
| `switch-database.js` | Script para alternar entre bancos |

## 🚀 Iniciando o Sistema

Após alternar o banco, reinicie o servidor:

```bash
# Desenvolvimento
npm run dev

# Desenvolvimento com nomeia-ai
npm run dev:nomeia
```

## ⚠️ Importante

- **SEMPRE** use o banco `nomeia-ai` para desenvolvimento e testes
- **NUNCA** use o banco `convoca-ai` para testes que possam afetar dados reais
- O arquivo `.env.local` é ignorado pelo git por segurança
- Faça backup dos dados antes de alternar bancos

## 🔍 Verificando Banco Ativo

Para verificar qual banco está sendo usado, verifique o arquivo `.env.local`:

```bash
cat .env.local | grep VITE_SUPABASE_URL
```

## 🛠️ Desenvolvimento Seguro

1. **Sempre** comece com o banco `nomeia-ai`
2. **Teste** todas as funcionalidades no ambiente de desenvolvimento
3. **Valide** que tudo está funcionando corretamente
4. **Apenas então** altere para o banco de produção se necessário

## 📊 Status dos Bancos

- ✅ **nomeia-ai**: Restaurado e pronto para uso
- ✅ **convoca-ai**: Produção ativa
- 🔄 **Sincronização**: Automática via dump/restore



