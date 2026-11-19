# Exemplos Práticos de Uso do Sistema de Logging

## Cenários de Uso Comuns

### 1. Autenticação de Usuário

#### Servidor (Backend)
```typescript
// Login bem-sucedido
serverLogger.info(
  'User login successful',
  'AUTH',
  { 
    userId: user.id, 
    email: user.email,
    loginMethod: 'email',
    timestamp: new Date().toISOString()
  },
  user.id,
  req.ip,
  req.headers['user-agent']
);

// Tentativa de login falhada
serverLogger.warn(
  'Failed login attempt',
  'AUTH',
  { 
    email: loginData.email,
    reason: 'Invalid password',
    attempts: userLoginAttempts,
    ip: req.ip
  },
  undefined,
  req.ip,
  req.headers['user-agent']
);

// Violação de segurança
serverLogger.security(
  'Multiple failed login attempts',
  'SECURITY',
  { 
    email: loginData.email,
    attempts: 5,
    ip: req.ip,
    blocked: true
  },
  undefined,
  req.ip,
  req.headers['user-agent']
);
```

#### Cliente (Frontend)
```typescript
// Ação de login do usuário
clientLogger.userAction(
  'Login form submitted',
  'UI_INTERACTION',
  { 
    formId: 'login-form',
    email: loginData.email,
    timestamp: new Date().toISOString()
  }
);

// Erro de API
clientLogger.error(
  'Login API failed',
  'API',
  { 
    url: '/api/auth/login',
    status: 401,
    error: 'Invalid credentials',
    timestamp: new Date().toISOString()
  }
);
```

### 2. Operações de Banco de Dados

#### Servidor (Backend)
```typescript
// Query executada com sucesso
serverLogger.database(
  'User query executed successfully',
  'DATABASE',
  { 
    query: 'SELECT * FROM users WHERE id = $1',
    executionTime: 45,
    rowsReturned: 1,
    userId: '123'
  },
  '123'
);

// Erro de banco de dados
serverLogger.error(
  'Database connection failed',
  'DATABASE',
  { 
    error: 'Connection timeout',
    retries: 3,
    maxRetries: 5,
    database: 'nomeia_ai_prod'
  }
);

// Transação complexa
serverLogger.database(
  'Transaction completed',
  'DATABASE',
  { 
    operation: 'create_ranking_with_disciplines',
    tables: ['rankings', 'disciplines', 'user_rankings'],
    executionTime: 250,
    rowsAffected: 15
  }
);
```

### 3. Chamadas de API Externas

#### Servidor (Backend)
```typescript
// Chamada de API externa
serverLogger.api(
  'External API call initiated',
  'EXTERNAL_API',
  { 
    url: 'https://api.external-service.com/users',
    method: 'POST',
    timeout: 5000
  },
  '123',
  '192.168.1.1'
);

// Resposta da API externa
serverLogger.api(
  'External API call completed',
  'EXTERNAL_API',
  { 
    url: 'https://api.external-service.com/users',
    status: 200,
    responseTime: 1200,
    dataSize: '2.5KB'
  },
  '123',
  '192.168.1.1'
);

// Erro de API externa
serverLogger.error(
  'External API call failed',
  'EXTERNAL_API',
  { 
    url: 'https://api.external-service.com/users',
    status: 500,
    error: 'Internal Server Error',
    retries: 2
  },
  '123',
  '192.168.1.1'
);
```

### 4. Interações do Usuário

#### Cliente (Frontend)
```typescript
// Clique em botão
clientLogger.userAction(
  'Button clicked',
  'UI_INTERACTION',
  { 
    buttonId: 'submit-ranking',
    formId: 'create-ranking-form',
    timestamp: new Date().toISOString()
  }
);

// Navegação entre páginas
clientLogger.userAction(
  'Page navigation',
  'UI_INTERACTION',
  { 
    from: '/rankings',
    to: '/ranking/123',
    method: 'click',
    timestamp: new Date().toISOString()
  }
);

// Upload de arquivo
clientLogger.userAction(
  'File upload initiated',
  'UI_INTERACTION',
  { 
    fileType: 'image/png',
    fileSize: '2.5MB',
    fileName: 'ranking-image.png',
    timestamp: new Date().toISOString()
  }
);
```

### 5. Performance e Monitoramento

#### Cliente (Frontend)
```typescript
// Carregamento de página
clientLogger.performance(
  'Page load completed',
  'PERFORMANCE',
  { 
    page: '/rankings',
    loadTime: 1200,
    resources: 15,
    domContentLoaded: 800,
    timestamp: new Date().toISOString()
  }
);

// Operação lenta
clientLogger.warn(
  'Slow operation detected',
  'PERFORMANCE',
  { 
    operation: 'fetchRankings',
    duration: 5000,
    threshold: 3000,
    timestamp: new Date().toISOString()
  }
);
```

#### Servidor (Backend)
```typescript
// Requisição lenta
serverLogger.warn(
  'Slow request detected',
  'PERFORMANCE',
  { 
    method: 'POST',
    url: '/api/rankings',
    duration: 5000,
    threshold: 3000,
    userId: '123'
  },
  '123',
  '192.168.1.1'
);

// Uso de memória alto
serverLogger.warn(
  'High memory usage detected',
  'SYSTEM',
  { 
    memoryUsage: '85%',
    threshold: '80%',
    processId: process.pid,
    timestamp: new Date().toISOString()
  }
);
```

### 6. Erros e Exceções

#### Cliente (Frontend)
```typescript
// Erro de JavaScript
clientLogger.error(
  'JavaScript error occurred',
  'GLOBAL_ERROR',
  { 
    message: error.message,
    stack: error.stack,
    filename: error.filename,
    lineno: error.lineno,
    colno: error.colno,
    timestamp: new Date().toISOString()
  }
);

// Erro de Promise rejeitada
clientLogger.error(
  'Unhandled promise rejection',
  'GLOBAL_ERROR',
  { 
    reason: error.reason,
    promise: error.promise,
    timestamp: new Date().toISOString()
  }
);
```

#### Servidor (Backend)
```typescript
// Erro de aplicação
serverLogger.error(
  'Application error occurred',
  'APPLICATION',
  { 
    error: error.message,
    stack: error.stack,
    userId: '123',
    requestId: req.id
  },
  '123',
  '192.168.1.1'
);

// Erro de validação
serverLogger.warn(
  'Validation error',
  'VALIDATION',
  { 
    field: 'email',
    value: 'invalid-email',
    rule: 'email_format',
    userId: '123'
  },
  '123'
);
```

### 7. Logs de Acesso HTTP

#### Middleware Automático
```typescript
// Requisição GET
// Log automático via middleware
// GET /api/rankings 200 150ms

// Requisição POST
// Log automático via middleware  
// POST /api/rankings 201 300ms

// Erro 404
// Log automático via middleware
// GET /api/nonexistent 404 50ms

// Erro 500
// Log automático via middleware
// POST /api/rankings 500 2000ms
```

### 8. Logs de Segurança

#### Servidor (Backend)
```typescript
// Tentativa de acesso não autorizado
serverLogger.security(
  'Unauthorized access attempt',
  'SECURITY',
  { 
    resource: '/api/admin/users',
    method: 'GET',
    ip: '192.168.1.100',
    userAgent: 'curl/7.68.0',
    timestamp: new Date().toISOString()
  },
  undefined,
  '192.168.1.100',
  'curl/7.68.0'
);

// Rate limiting ativado
serverLogger.security(
  'Rate limit exceeded',
  'SECURITY',
  { 
    endpoint: '/api/auth/login',
    ip: '192.168.1.100',
    attempts: 10,
    window: '1 minute',
    blocked: true
  },
  undefined,
  '192.168.1.100'
);
```

### 9. Logs de Debug (Desenvolvimento)

#### Servidor (Backend)
```typescript
// Debug de query SQL
serverLogger.debug(
  'SQL query executed',
  'DATABASE_DEBUG',
  { 
    query: 'SELECT * FROM users WHERE email = $1',
    parameters: ['user@example.com'],
    executionTime: 25,
    rowsReturned: 1
  }
);

// Debug de cache
serverLogger.debug(
  'Cache operation',
  'CACHE_DEBUG',
  { 
    operation: 'get',
    key: 'user:123:profile',
    hit: true,
    ttl: 3600
  }
);
```

#### Cliente (Frontend)
```typescript
// Debug de estado React
clientLogger.debug(
  'State updated',
  'REACT_DEBUG',
  { 
    component: 'UserProfile',
    previousState: { loading: true, user: null },
    newState: { loading: false, user: { id: '123', name: 'John' } },
    timestamp: new Date().toISOString()
  }
);

// Debug de hook
clientLogger.debug(
  'Hook executed',
  'REACT_DEBUG',
  { 
    hook: 'useEffect',
    component: 'RankingTable',
    dependencies: ['rankings', 'loading'],
    timestamp: new Date().toISOString()
  }
);
```

### 10. Integração com Supabase

#### Servidor (Backend)
```typescript
// Evento de autenticação Supabase
serverLogger.info(
  'Supabase auth event',
  'SUPABASE_AUTH',
  { 
    event: 'SIGNED_IN',
    userId: user.id,
    email: user.email,
    provider: 'email'
  },
  user.id
);

// Operação de banco Supabase
serverLogger.database(
  'Supabase query executed',
  'SUPABASE_DB',
  { 
    table: 'user_rankings',
    operation: 'insert',
    rowsAffected: 1,
    executionTime: 100
  }
);
```

## Padrões de Uso Recomendados

### 1. Estrutura de Contexto
```typescript
// Use contextos específicos e consistentes
const CONTEXTS = {
  AUTH: 'AUTH',
  DATABASE: 'DATABASE',
  API: 'API',
  UI: 'UI_INTERACTION',
  PERFORMANCE: 'PERFORMANCE',
  SECURITY: 'SECURITY'
};
```

### 2. Estrutura de Dados
```typescript
// Sempre inclua timestamp e userId quando disponível
const logData = {
  timestamp: new Date().toISOString(),
  userId: user?.id,
  operation: 'create_ranking',
  details: { /* dados específicos */ }
};
```

### 3. Níveis de Log
```typescript
// Use níveis apropriados
// DEBUG: Informações detalhadas para desenvolvimento
// INFO: Operações normais e importantes
// WARN: Situações anômalas que não impedem funcionamento
// ERROR: Erros que impedem funcionamento ou causam problemas
```

### 4. Redação de Dados Sensíveis
```typescript
// Sempre redija dados sensíveis
const sanitizedData = {
  email: 'user@example.com', // OK
  password: '[REDACTED]',     // Redigido
  token: '[REDACTED]',        // Redigido
  creditCard: '[REDACTED]'    // Redigido
};
```

## Monitoramento e Alertas

### 1. Métricas Importantes
- **Taxa de erro**: `error_logs / total_logs`
- **Tempo de resposta**: Média dos tempos em `access_logs`
- **Atividade de usuário**: Contagem de `userAction` logs
- **Violações de segurança**: Contagem de `security` logs

### 2. Alertas Recomendados
- **Erros críticos**: > 5% dos logs
- **Tempo de resposta**: > 5 segundos
- **Tentativas de login**: > 10 falhas por minuto
- **Uso de disco**: > 80% da capacidade

### 3. Dashboards Sugeridos
- **Visão geral**: Total de logs por nível e categoria
- **Performance**: Tempo de resposta por endpoint
- **Segurança**: Tentativas de acesso não autorizado
- **Erros**: Top erros por frequência e impacto
