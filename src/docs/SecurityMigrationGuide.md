# 🔒 Guia de Migração de Segurança

## Visão Geral

Este guia documenta a migração gradual do sistema de cálculos de pontuação do frontend para o backend, garantindo maior segurança e consistência.

## 🎯 Objetivos

- **Segurança**: Mover lógica crítica para o backend
- **Consistência**: Garantir que frontend e backend sempre concordem
- **Migração Gradual**: Permitir transição sem interrupção do serviço
- **Monitoramento**: Detectar discrepâncias automaticamente

## 🏗️ Arquitetura

### Antes (Frontend Only)
```
Frontend → Cálculo Local → Resultado
```

### Depois (Híbrido com Migração)
```
Frontend → Feature Flag → Backend (Seguro) / Frontend (Fallback)
                ↓
         Validação Dupla → Log de Discrepâncias
```

## 📁 Estrutura de Arquivos

```
src/
├── config/
│   └── featureFlags.ts          # Controle de features
├── services/
│   ├── scoring.ts               # Lógica original (deprecated)
│   └── secureScoring.ts         # Novo sistema híbrido
├── tests/
│   └── security-migration.test.ts # Testes de consistência
└── examples/
    └── secureScoringExample.ts  # Exemplos de uso
```

## 🚀 Como Usar

### 1. Uso Básico

```typescript
import { calculateSecureScore } from '@/services/secureScoring';

const resultado = await calculateSecureScore({
  questionWeight: 1,
  disciplineWeight: 2,
  isCorrect: true,
  isNullified: false,
  isBlank: false,
  examType: 'Múltipla Escolha',
  wrongAnswerPenalty: 0,
  context: 'meu-contexto',
});
```

### 2. Validação de Consistência

```typescript
import { validateScoring } from '@/services/secureScoring';

const validacao = await validateScoring(input);
if (!validacao.valid) {
  console.warn('Discrepância detectada!', validacao.comparison.differences);
}
```

### 3. Controle por Feature Flags

```typescript
import { updateFeatureFlags } from '@/config/featureFlags';

// Habilitar backend para todos
updateFeatureFlags({ useBackendScoring: true });

// Habilitar apenas para usuários específicos
const userFlags = getUserFeatureFlags(userId);
```

## 🔧 Configuração

### Feature Flags Disponíveis

| Flag | Descrição | Padrão |
|------|-----------|--------|
| `useBackendScoring` | Usar backend para cálculos | `false` (dev), `true` (prod) |
| `useBackendValidation` | Usar backend para validações | `false` |
| `useBackendRanking` | Usar backend para rankings | `false` |
| `enableSecurityLogging` | Habilitar logs de segurança | `true` |

### Configuração por Ambiente

```typescript
// Desenvolvimento
const devFlags = {
  useBackendScoring: false,
  enableSecurityLogging: true,
};

// Produção
const prodFlags = {
  useBackendScoring: true,
  enableSecurityLogging: true,
};
```

## 🧪 Testes

### Executar Testes de Migração

```bash
npm test -- src/tests/security-migration.test.ts
```

### Testes Incluídos

- ✅ Consistência frontend vs backend
- ✅ Comportamento de feature flags
- ✅ Tratamento de erros e fallback
- ✅ Lógica de cálculo para todos os tipos de exame
- ✅ Detecção de discrepâncias

## 📊 Monitoramento

### Logs de Segurança

O sistema gera logs automáticos para:

- Uso de features (quando `enableSecurityLogging: true`)
- Discrepâncias entre frontend e backend
- Erros de fallback
- Chamadas para funções PostgreSQL

### Exemplo de Log

```
[FEATURE_FLAG] useBackendScoring used in backend-ranking-calculation
[calculateBackendScore] Backend error: Connection timeout
[calculateBackendScore] Falling back to frontend
[validateScoring] Score mismatch detected: { differences: {...} }
```

## 🔄 Migração Gradual

### Fase 1: Preparação ✅
- [x] Criar branch de segurança
- [x] Implementar feature flags
- [x] Criar sistema híbrido
- [x] Implementar testes

### Fase 2: Validação (Próxima)
- [ ] Implementar validações duplas
- [ ] Adicionar Row Level Security
- [ ] Configurar monitoramento

### Fase 3: Migração
- [ ] Migrar usuários beta
- [ ] Migrar usuários graduais
- [ ] Migrar todos os usuários

### Fase 4: Limpeza
- [ ] Remover código frontend antigo
- [ ] Otimizar performance
- [ ] Documentar lições aprendidas

## 🛡️ Segurança

### Row Level Security (RLS)

```sql
-- Política para user_rankings
CREATE POLICY user_rankings_policy ON user_rankings
FOR ALL USING (auth.uid() = user_id);
```

### Validação de Entrada

```typescript
// Validação automática no backend
const validateInput = (input: SecureScoringInput) => {
  if (input.questionWeight < 0) throw new Error('Peso inválido');
  if (input.wrongAnswerPenalty < 0) throw new Error('Penalidade inválida');
  // ... outras validações
};
```

## 🚨 Troubleshooting

### Problema: Backend não responde
**Solução**: Sistema automaticamente faz fallback para frontend

### Problema: Discrepâncias detectadas
**Solução**: Verificar logs e comparar implementações

### Problema: Performance lenta
**Solução**: Ajustar feature flags para usar frontend quando apropriado

## 📈 Métricas de Sucesso

- [ ] 0 discrepâncias entre frontend e backend
- [ ] 100% de cobertura de testes
- [ ] Tempo de resposta < 100ms
- [ ] 0 erros de segurança

## 🤝 Contribuição

1. Sempre execute os testes antes de fazer commit
2. Documente mudanças nas feature flags
3. Adicione logs para novas funcionalidades
4. Mantenha compatibilidade com sistema antigo durante migração

## 📞 Suporte

Para dúvidas ou problemas:
- Verifique os logs de segurança
- Execute os testes de migração
- Consulte os exemplos em `src/examples/`
- Abra uma issue com detalhes do problema
