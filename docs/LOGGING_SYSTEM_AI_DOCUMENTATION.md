# Sistema de Logging - Documentação Técnica para IA

## Visão Geral do Sistema

O sistema de logging do Nomeia Aí é uma solução completa de monitoramento e rastreamento de eventos que opera em duas camadas principais: **servidor (backend)** e **cliente (frontend)**. O sistema foi projetado para ser escalável, seguro e facilmente integrável com ferramentas de monitoramento modernas.

## Arquitetura do Sistema

### Estrutura de Diretórios
```
logs/
├── server/          # Logs do servidor Node.js/Express
├── client/          # Logs do frontend React
├── errors/          # Logs de erros críticos (ambas as camadas)
├── access/          # Logs de acesso HTTP/API
├── debug/           # Logs de debug (desenvolvimento)
└── .gitignore       # Exclusão de logs do controle de versão
```

### Componentes Principais

#### 1. ServerLogger (`src/services/serverLogger.ts`)
- **Tipo**: Classe Singleton
- **Propósito**: Gerenciar logs do servidor backend
- **Dependências**: `fs`, `path` (Node.js nativos)
- **Funcionalidades**:
  - Rotação automática de arquivos (10MB, 5 versões)
  - Categorização por tipo de log
  - Formatação JSON estruturada
  - Redação de dados sensíveis

#### 2. ClientLogger (`src/services/clientLogger.ts`)
- **Tipo**: Classe Singleton
- **Propósito**: Gerenciar logs do frontend React
- **Dependências**: APIs nativas do navegador
- **Funcionalidades**:
  - Armazenamento em memória (máximo 100 logs)
  - Envio automático de erros para servidor em produção
  - Exportação e download de logs
  - Integração com eventos globais do navegador

#### 3. LoggingMiddleware (`src/middleware/loggingMiddleware.ts`)
- **Tipo**: Middleware Express.js
- **Propósito**: Interceptar e logar requisições HTTP
- **Funcionalidades**:
  - Logs de requisições e respostas
  - Medição de tempo de resposta
  - Extração de contexto de usuário
  - Tratamento de erros HTTP

#### 4. LoggingConfig (`src/config/logging.ts`)
- **Tipo**: Configuração centralizada
- **Propósito**: Controlar comportamento do sistema de logging
- **Funcionalidades**:
  - Configuração por variáveis de ambiente
  - Níveis de log configuráveis
  - Controle de redação de dados sensíveis
  - Habilitação/desabilitação por categoria

## Formato de Dados

### Estrutura do Log Entry
```typescript
interface LogEntry {
  timestamp: string;        // ISO 8601 timestamp
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;          // Mensagem descritiva
  context?: string;         // Contexto da aplicação
  data?: any;              // Dados adicionais (JSON stringified)
  userId?: string;         // ID do usuário (quando disponível)
  ip?: string;             // Endereço IP (servidor)
  userAgent?: string;      // User-Agent do navegador
}
```

### Exemplo de Log Real
```json
{
  "timestamp": "2025-01-15T20:04:30.123Z",
  "level": "info",
  "message": "User authentication successful",
  "context": "AUTH",
  "data": "{\"userId\":\"123\",\"email\":\"user@example.com\"}",
  "userId": "123",
  "ip": "192.168.1.1",
  "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
}
```

## Níveis de Log

### Hierarquia de Níveis
1. **debug** - Informações detalhadas para desenvolvimento
2. **info** - Informações gerais sobre operações
3. **warn** - Avisos sobre situações anômalas
4. **error** - Erros que não impedem o funcionamento

### Filtros por Ambiente
- **Desenvolvimento**: Todos os níveis habilitados
- **Produção**: Apenas info, warn, error
- **Teste**: Configurável via variáveis de ambiente

## Categorias de Log

### Server Logs
- **AUTH**: Autenticação e autorização
- **DATABASE**: Operações de banco de dados
- **API**: Chamadas de API externas
- **SECURITY**: Violações de segurança
- **HTTP_REQUEST**: Requisições HTTP
- **HTTP_ERROR**: Erros HTTP

### Client Logs
- **REACT_COMPONENT**: Eventos de componentes React
- **UI_INTERACTION**: Interações do usuário
- **API**: Chamadas de API do frontend
- **PERFORMANCE**: Métricas de performance
- **GLOBAL_ERROR**: Erros não capturados

## Rotação de Arquivos

### Configuração
- **Tamanho máximo**: 10MB por arquivo
- **Versões mantidas**: 5 arquivos por categoria
- **Estratégia**: Rotação automática quando limite é atingido

### Nomenclatura
- **Formato**: `{level}-{YYYY-MM-DD}.log`
- **Exemplo**: `info-2025-01-15.log`
- **Versões**: `info-2025-01-15.log.1`, `info-2025-01-15.log.2`, etc.

## Segurança e Privacidade

### Redação de Dados Sensíveis
```typescript
redactFields: [
  'password', 'token', 'authorization', 'secret', 
  'key', 'ssn', 'creditCard', 'cvv'
]
```

### Controle de Acesso
- Logs armazenados localmente no servidor
- Exclusão do controle de versão (Git)
- Permissões de arquivo restritivas
- Rotação automática para limitar exposição

## Integração com Aplicação

### No Servidor (Node.js/Express)
```typescript
import { serverLogger } from '@/services/serverLogger';

// Log de operação
serverLogger.info('User created', 'USER_MANAGEMENT', { userId: '123' });

// Log de erro
serverLogger.error('Database error', 'DATABASE', { error: 'Connection failed' });

// Log de acesso
serverLogger.access('GET', '/api/users', 200, 150, 'user123', '192.168.1.1');
```

### No Cliente (React)
```typescript
import { clientLogger } from '@/services/clientLogger';

// Log de ação do usuário
clientLogger.userAction('Button clicked', 'UI_INTERACTION', { buttonId: 'submit' });

// Log de erro
clientLogger.error('API failed', 'API', { url: '/api/users', status: 500 });
```

### Middleware Express
```typescript
import { loggingMiddleware, errorLoggingMiddleware } from '@/middleware/loggingMiddleware';

app.use(loggingMiddleware);
app.use(errorLoggingMiddleware);
```

## Configuração por Variáveis de Ambiente

### Variáveis Disponíveis
```bash
# Habilitar logging
ENABLE_LOGGING=true

# Nível de log do servidor
LOG_LEVEL=info  # debug, info, warn, error

# Nível de log do cliente
CLIENT_LOG_LEVEL=warn  # debug, info, warn, error

# Habilitar logging do cliente
ENABLE_CLIENT_LOGGING=true
```

### Configuração Programática
```typescript
import { loggingConfig } from '@/config/logging';

// Verificar se logging está habilitado
if (loggingConfig.server.enabled) {
  // Fazer log
}

// Verificar nível de log
if (shouldLogLevel('debug', loggingConfig.server.level)) {
  // Fazer log de debug
}
```

## Monitoramento e Alertas

### Métricas Importantes
- **Taxa de erro**: Proporção de logs de erro vs total
- **Tempo de resposta**: Latência de operações
- **Atividade de usuário**: Padrões de uso
- **Violações de segurança**: Tentativas de acesso não autorizado

### Alertas Recomendados
- **Erros críticos**: > 5% dos logs
- **Tempo de resposta**: > 5 segundos
- **Tentativas de login**: > 10 falhas por minuto
- **Uso de disco**: > 80% da capacidade

## Troubleshooting

### Problemas Comuns

#### 1. Logs não aparecem
- **Causa**: `ENABLE_LOGGING=false` ou nível de log muito alto
- **Solução**: Verificar variáveis de ambiente e configuração

#### 2. Logs muito grandes
- **Causa**: Logs de debug em produção
- **Solução**: Ajustar nível de log e tamanho máximo de arquivo

#### 3. Performance degradada
- **Causa**: Logs síncronos bloqueando operações
- **Solução**: Implementar logging assíncrono

### Comandos de Diagnóstico
```bash
# Verificar tamanho dos logs
du -sh logs/*

# Contar linhas de log
wc -l logs/server/*.log

# Filtrar erros
grep '"level":"error"' logs/errors/*.log
```

## Extensibilidade

### Adicionando Novas Categorias
```typescript
// Em serverLogger.ts
security(message: string, context?: string, data?: any, userId?: string, ip?: string, userAgent?: string): void {
  const entry = this.createLogEntry('warn', message, context, data, userId, ip, userAgent);
  this.writeLog('errors', entry);
}
```

### Integração com Ferramentas Externas
- **ELK Stack**: Logstash para ingestão
- **Splunk**: Universal Forwarder
- **Datadog**: Agent de logging
- **New Relic**: Logs como dados

### Hooks Personalizados
```typescript
// Hook para processamento customizado
const customLogProcessor = (entry: LogEntry) => {
  // Processamento personalizado
  if (entry.level === 'error') {
    // Enviar alerta
  }
};
```

## Considerações de Performance

### Otimizações Implementadas
- **Rotação assíncrona**: Não bloqueia operações principais
- **Buffer de logs**: Agrupamento de logs para escrita eficiente
- **Compressão**: Arquivos antigos podem ser comprimidos
- **Limpeza automática**: Remoção de logs antigos

### Métricas de Performance
- **Latência de log**: < 1ms por entrada
- **Uso de memória**: < 10MB para buffer
- **Uso de disco**: Controlado por rotação
- **CPU**: < 1% durante operação normal

## Conformidade e Auditoria

### Requisitos de Auditoria
- **Imutabilidade**: Logs não podem ser modificados
- **Integridade**: Checksums para verificação
- **Retenção**: Período mínimo de 1 ano
- **Acesso**: Logs de acesso aos logs

### LGPD/GDPR
- **Anonimização**: Dados pessoais redigidos
- **Consentimento**: Logs de consentimento
- **Direito ao esquecimento**: Exclusão de logs antigos
- **Portabilidade**: Exportação de dados

## Manutenção

### Tarefas Regulares
- **Limpeza de logs antigos**: Semanal
- **Verificação de integridade**: Diária
- **Backup de logs críticos**: Diária
- **Análise de padrões**: Mensal

### Scripts de Manutenção
```bash
#!/bin/bash
# Limpeza de logs antigos
find logs/ -name "*.log" -mtime +30 -delete

# Backup de logs críticos
tar -czf logs-backup-$(date +%Y%m%d).tar.gz logs/errors/

# Verificação de integridade
find logs/ -name "*.log" -exec wc -l {} \;
```

## Conclusão

O sistema de logging do Nomeia Aí é uma solução robusta e escalável que fornece visibilidade completa sobre o funcionamento da aplicação. Sua arquitetura modular permite fácil extensão e integração com ferramentas de monitoramento modernas, enquanto mantém a segurança e privacidade dos dados dos usuários.

A documentação técnica apresentada permite que uma IA compreenda completamente a estrutura, funcionamento e possibilidades de extensão do sistema, facilitando futuras implementações e melhorias.
