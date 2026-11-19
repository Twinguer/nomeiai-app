# Análise: Múltiplas Versões de Serviços

## 📋 Resumo Executivo

**Prioridade:** ALTA  
**Status:** Análise Completa  
**Impacto:** Alto - Manutenibilidade, Consistência e Performance

## 🔍 Problemas Identificados

### 1. Múltiplas Versões de RankingService

#### rankingService.ts (V1 - Original)
- **Status:** ⚠️ PARCIALMENTE ATIVO
- **Uso Atual:**
  - `useResultadosData.tsx` - Hook principal de resultados
  - `useRankingsPagination.tsx` - Paginação
  - `concursoService.ts` - Serviço de concursos
  - `RankingTable.tsx` - Tabela de rankings (tipo `Ranking`)
  - `RankingTableVirtual.tsx` - Tabela virtual (tipo `Ranking`)
- **Características:**
  - Usa RPC `get_rankings_for_concurso` ✅
  - Interface `Ranking` bem definida
  - Cache: `rankingCache` (V1)
  - Formatação via `buildRankingFromConsolidated`

#### rankingServiceV2.ts
- **Status:** ⚠️ PARCIALMENTE ATIVO
- **Uso Atual:**
  - `useRankingsDataV2.tsx` - Hook específico V2
- **Características:**
  - Usa query direta `.from('user_rankings')` ❌ (não usa RPC)
  - Interface `RankingV2` diferente de `Ranking`
  - Cache: `rankingCache` (V1) - compartilhado com V1
  - Busca todos os rankings e filtra no frontend ❌

#### rankingServiceV3.ts
- **Status:** ✅ MAIS ATIVO
- **Uso Atual:**
  - `useRankingsDataV3.tsx` - Hook específico V3
  - `RankingsTab.tsx` - Tab de rankings do perfil
  - `PublicUserProfile.tsx` - Perfil público
  - `UserProfile.tsx` - Perfil do usuário
- **Características:**
  - Usa query direta `.from('user_rankings')` com JOIN ❌ (não usa RPC)
  - Interface `RankingV3` diferente de `Ranking` e `RankingV2`
  - Cache: `rankingCache` (V1) - compartilhado com V1
  - JOIN nativo com `users_profiles` ✅ (mais eficiente)

### 2. Múltiplas Versões de RankingCache

#### rankingCache.ts (V1)
- **Status:** ✅ ATIVO (usado por todas as versões)
- **Uso:**
  - `rankingService.ts` (V1)
  - `rankingServiceV2.ts` (V2)
  - `rankingServiceV3.ts` (V3)
  - `ResultadosPage.tsx`
  - `useSaveAnswers/index.tsx`
  - `useLeaveRanking.ts`
- **Características:**
  - Cache simples com TTL de 5 minutos
  - Métodos: `getRankings()`, `setRankings()`, `clear()`
  - Não diferencia por `reservationType`

#### rankingCacheV2.ts
- **Status:** ❌ NÃO USADO (código morto)
- **Uso:** Nenhum arquivo importa ou usa
- **Características:**
  - Cache mais sofisticado com múltiplos tipos
  - Suporta `reservationType` na chave
  - Cache de estatísticas separado
  - Preload de dados
  - **PROBLEMA:** Criado mas nunca integrado

## 📊 Análise de Uso

### Distribuição de Uso por Versão

```
rankingService.ts (V1):     5 arquivos
rankingServiceV2.ts:        1 arquivo (useRankingsDataV2.tsx)
rankingServiceV3.ts:        4 arquivos
rankingCache.ts (V1):       6 arquivos (compartilhado)
rankingCacheV2.ts:           0 arquivos (não usado)
```

### Interfaces Diferentes

1. **Ranking** (V1):
   - `position`, `name`, `score`, `userId`, `avatarUrl`
   - Pontuações subjetivas e ponderadas
   - `reservationType`, `displayReservation`
   - `quotaPosition`

2. **RankingV2**:
   - Similar a `Ranking` mas com campos adicionais
   - `rankingId`, `createdAt`
   - Estrutura ligeiramente diferente

3. **RankingV3**:
   - Mais completo que V1 e V2
   - Campos adicionais para estatísticas
   - Melhor tipagem

## ⚠️ Inconsistências Identificadas

### 1. Diferentes Estratégias de Query

- **V1:** Usa RPC `get_rankings_for_concurso` ✅
- **V2:** Query direta `.from('user_rankings')` ❌
- **V3:** Query direta com JOIN `.from('user_rankings').select('..., users_profiles!inner(...)')` ❌

### 2. Diferentes Estratégias de Cache

- **V1, V2, V3:** Todos usam `rankingCache` (V1)
- **V2 Cache:** Criado mas nunca usado
- Cache não diferencia por `reservationType` (exceto V2 cache não usado)

### 3. Diferentes Interfaces

- Três interfaces diferentes (`Ranking`, `RankingV2`, `RankingV3`)
- Componentes precisam converter entre tipos
- TypeScript não garante consistência

### 4. Código Morto

- `rankingCacheV2.ts` - Criado mas nunca usado
- `useRankingsDataV2.tsx` - Usa V2 mas poderia usar V3
- Funções deprecated em `userRankings.ts`

## 🎯 Plano de Consolidação

### Fase 1: Padronizar em V3 (Recomendado)

**Justificativa:**
- V3 é a versão mais completa
- Usa JOIN nativo (mais eficiente)
- Melhor tipagem
- Mais arquivos já usam V3

**Ações:**
1. ✅ Migrar `useResultadosData.tsx` para usar V3
2. ✅ Migrar `useRankingsPagination.tsx` para usar V3
3. ✅ Migrar `concursoService.ts` para usar V3
4. ✅ Atualizar `RankingTable.tsx` para usar interface `RankingV3`
5. ✅ Atualizar `RankingTableVirtual.tsx` para usar interface `RankingV3`
6. ✅ Deprecar `rankingService.ts` (V1)
7. ✅ Deprecar `rankingServiceV2.ts`
8. ✅ Remover `rankingCacheV2.ts` (não usado)

### Fase 2: Migrar V3 para usar RPCs

**Ações:**
1. ✅ Atualizar `fetchUserRankingsV3` para usar RPC `get_rankings_for_concurso`
2. ✅ Remover query direta `.from('user_rankings')`
3. ✅ Manter JOIN com `users_profiles` no RPC (se necessário)

### Fase 3: Consolidar Cache

**Ações:**
1. ✅ Atualizar `rankingCache.ts` para suportar `reservationType`
2. ✅ Adicionar métodos de `rankingCacheV2.ts` que fazem sentido
3. ✅ Remover `rankingCacheV2.ts`
4. ✅ Garantir que todos os serviços usem o mesmo cache

### Fase 4: Limpeza Final

**Ações:**
1. ✅ Remover arquivos deprecated
2. ✅ Atualizar todos os imports
3. ✅ Atualizar testes
4. ✅ Documentar interface única `RankingV3`

## 📝 Estrutura Proposta

### rankingService.ts (Único)
```typescript
// Consolidado - usa apenas V3
export interface Ranking {
  // Interface unificada (baseada em V3)
}

export const fetchUserRankings = async (
  concursoId: string,
  reservationType?: string,
  offset?: number,
  limit?: number
): Promise<Ranking[]> => {
  // Usa RPC get_rankings_for_concurso
  // Retorna interface unificada
}
```

### rankingCache.ts (Único)
```typescript
// Cache consolidado com suporte a reservationType
export const rankingCache = {
  getRankings(concursoId, page, limit, reservationType?): Ranking[] | null
  setRankings(concursoId, data, page, limit, reservationType?): void
  clear(): void
  // Métodos adicionais do V2 se necessário
}
```

## 🔒 Benefícios da Consolidação

### 1. Manutenibilidade
- ✅ Um único arquivo para manter
- ✅ Interface única e consistente
- ✅ Menos código duplicado
- ✅ Facilita debugging

### 2. Performance
- ✅ Cache unificado e otimizado
- ✅ Queries consistentes
- ✅ Menos requisições desnecessárias

### 3. Segurança
- ✅ Todas as queries via RPC
- ✅ Validação centralizada
- ✅ Controle de acesso consistente

### 4. Consistência
- ✅ Mesma interface em todo o sistema
- ✅ Mesmo comportamento de cache
- ✅ Mesma estratégia de query

## 📊 Métricas de Sucesso

- [ ] 100% dos componentes usando `rankingService.ts` único
- [ ] 0 arquivos usando V1 ou V2
- [ ] 1 único cache (`rankingCache.ts`)
- [ ] 1 única interface (`Ranking`)
- [ ] 100% das queries via RPC
- [ ] Redução de 50%+ em código duplicado

## 🚀 Próximos Passos Imediatos

1. **Criar issue de consolidação**
2. **Migrar `useResultadosData.tsx` para V3**
3. **Atualizar `RankingTable.tsx` para usar `RankingV3`**
4. **Migrar V3 para usar RPCs**
5. **Consolidar cache**
6. **Remover código morto**

## ⚠️ Riscos e Mitigações

### Risco 1: Quebrar funcionalidades existentes
**Mitigação:** Testes extensivos antes de remover versões antigas

### Risco 2: Performance piorar durante migração
**Mitigação:** Migração gradual com fallback para versões antigas

### Risco 3: Inconsistências durante transição
**Mitigação:** Manter ambas versões durante período de transição

## 📚 Referências

- `src/services/rankingService.ts` - V1
- `src/services/rankingServiceV2.ts` - V2
- `src/services/rankingServiceV3.ts` - V3
- `src/services/rankingCache.ts` - Cache V1
- `src/services/rankingCacheV2.ts` - Cache V2 (não usado)

