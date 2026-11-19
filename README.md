# Convoca AI - Plataforma de Rankings de Concursos Públicos

Plataforma completa para visualização e análise de rankings de concursos públicos, com funcionalidades de estudo, coach mode, e comunidade.

## 🚀 Tecnologias

Este projeto é construído com:

- **Vite** - Build tool e dev server
- **TypeScript** - Tipagem estática
- **React** - Biblioteca UI
- **shadcn-ui** - Componentes UI
- **Tailwind CSS** - Estilização
- **Supabase** - Backend e banco de dados
- **React Router** - Roteamento
- **TanStack Query** - Gerenciamento de estado do servidor

## 📋 Pré-requisitos

- Node.js (versão 18 ou superior)
- npm ou yarn
- Conta no Supabase (para backend)

## 🛠️ Instalação

```sh
# 1. Clone o repositório
git clone <YOUR_GIT_URL>

# 2. Navegue até o diretório do projeto
cd convoca-ai

# 3. Instale as dependências
npm install

# 4. Configure as variáveis de ambiente
# Copie o arquivo .env.example para .env e configure as variáveis necessárias
cp .env.example .env
```

## 🔧 Configuração

Configure as seguintes variáveis de ambiente no arquivo `.env`:

```env
VITE_SUPABASE_URL=sua_url_do_supabase
VITE_SUPABASE_ANON_KEY=sua_chave_anonima
VITE_OBFUSCATION_KEY=sua_chave_de_ofuscacao
VITE_URL_OBFUSCATION_KEY=sua_chave_de_ofuscacao_url
```

Para mais detalhes sobre configuração, consulte `docs/ENV_SETUP.md`.

## 🏃 Executando o Projeto

```sh
# Modo desenvolvimento
npm run dev

# Modo desenvolvimento (branch nomeia-ai)
npm run dev:nomeia

# Build de produção
npm run build

# Preview do build de produção
npm run preview
```

## 🧪 Testes

```sh
# Executar testes
npm test

# Executar testes em modo watch
npm run test:watch

# Executar testes com cobertura
npm run test:coverage

# Executar testes com UI
npm run test:ui
```

## 📦 Deploy

Para fazer deploy em produção, consulte a documentação em `docs/DEPLOY_PRODUCTION.md`.

### Deploy Rápido

```sh
# No servidor de produção
git pull origin main
npm install
npm run build
# Reinicie o servidor web (Nginx, PM2, etc.)
```

## 📚 Documentação Adicional

- `docs/ENV_SETUP.md` - Configuração de variáveis de ambiente
- `docs/DEPLOY_PRODUCTION.md` - Guia completo de deploy
- `docs/DEPLOY_RAPIDO.md` - Referência rápida de deploy

## 🤝 Contribuindo

1. Faça um fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto é privado e proprietário.

## 👥 Desenvolvimento

Desenvolvido por **Tryts Br**

## 📝 Sobre

Plataforma desenvolvida para Nomeia Aí / Convoca AI
