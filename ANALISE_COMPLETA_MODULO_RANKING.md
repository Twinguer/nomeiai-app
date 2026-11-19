# Análise Completa do Módulo de Ranking

## 📋 Estrutura do Módulo

### 1. Fluxo de Cálculo de Scores

#### Backend (PostgreSQL)
- **Função Principal**: `calculate_user_score_realtime(p_ranking_id, p_user_id, p_concurso_id, p_selected_booklet)`
  - Localização: `supabase/migrations/20250127000015_fix_discipline_weights_calculation.sql`
  - **Problema Identificado**: Linha 181-182 não normaliza `reservation_type` antes de verificar se é cota
  - **Impacto**: Usuários com `"AC"` são tratados como cota, buscando `minimum_total_score_cotas` (0) em vez de `minimum_total_score` (99)

#### Edge Function (Deno)
- **Função**: `calculate-ranking-score` (supabase/functions/calculate-ranking-score/index.ts)
  - Linha 201: `const isCotas = reservationType !== 'Ampla Concorrência';`
  - **Problema**: Não normaliza `reservationType` antes de verificar
  - **Impacto**: Mesmo problema do backend PostgreSQL

#### Frontend (TypeScript)
- **Serviço**: `rankingService.ts`
  - Linha 522: Normaliza `reservation_type` usando `normalizeReservationType()` ✅
  - **Status**: CORRETO - Já normaliza no frontend

- **Componente**: `RankingTable.tsx`
  - Linha 95: `const isCotas = reservationType !== 'Ampla Concorrência';`
  - **Problema**: Usa `reservationType` já normalizado do serviço, mas verifica diretamente
  - **Status**: Pode funcionar se o serviço já normalizou, mas não é garantido

### 2. Pontos de Uso de `reservation_type`

#### Backend PostgreSQL (`calculate_user_score_realtime`)
1. **Linha 181-182** (ANTES da correção):
   ```sql
   v_quota_type := v_user_ranking_data->'user_data'->>'reservation_type';
   v_is_quota := (v_quota_type IS NOT NULL AND v_quota_type != 'Ampla Concorrência');
   ```
   - ❌ **PROBLEMA**: Não normaliza "AC" para "Ampla Concorrência"
   - **Impacto**: `v_is_quota = true` quando deveria ser `false`

2. **Linha 257-260** (Uso de `v_is_quota`):
   ```sql
   IF v_is_quota THEN
     v_global_minimum_score := COALESCE((v_disciplines->>'minimum_total_score_cotas')::numeric, 0);
   ELSE
     v_global_minimum_score := COALESCE((v_disciplines->>'minimum_total_score')::numeric, 0);
   ```
   - **Impacto**: Se `v_is_quota = true` incorretamente, busca mínimo errado

3. **Linha 273-284** (Mínimos subjetivos):
   - Usa `v_is_quota` para determinar qual mínimo aplicar
   - **Impacto**: Aplica mínimos de cotas quando deveria aplicar de AC

4. **Linha 391-394** (Mínimos por disciplina):
   - Usa `v_is_quota` para determinar qual mínimo aplicar
   - **Impacto**: Aplica mínimos de cotas quando deveria aplicar de AC

5. **Linha 416-419** (Mínimos por bloco):
   - Usa `v_is_quota` para determinar qual mínimo aplicar
   - **Impacto**: Aplica mínimos de cotas quando deveria aplicar de AC

#### Edge Function (`calculate-ranking-score/index.ts`)
1. **Linha 201**:
   ```typescript
   const isCotas = reservationType !== 'Ampla Concorrência';
   ```
   - ❌ **PROBLEMA**: Não normaliza `reservationType` antes de verificar
   - **Impacto**: `isCotas = true` quando `reservationType = "AC"`

2. **Linha 202**:
   ```typescript
   const applicableMinimum = isCotas ? minimumTotalScoreCotas : minimumTotalScore;
   ```
   - **Impacto**: Usa mínimo errado se `isCotas` está incorreto

3. **Linha 218** (Mínimos por disciplina):
   ```typescript
   const minScore = isCotas ? (discipline.minimum_score_cotas || 0) : (discipline.minimum_score || 0);
   ```
   - **Impacto**: Aplica mínimo errado se `isCotas` está incorreto

4. **Linha 231** (Mínimos por bloco):
   ```typescript
   const minScore = isCotas ? (block.blockMinimumCotas || 0) : (block.blockMinimumScore || 0);
   ```
   - **Impacto**: Aplica mínimo errado se `isCotas` está incorreto

#### Frontend (`rankingService.ts`)
1. **Linha 278-298** (`isBelowMinimum`):
   ```typescript
   const isBelowMinimum = (rankingData: any): boolean => {
     // Verifica flag belowMinimum do backend (confia no backend)
     const belowMinimum = !!(userData?.belowMinimum || userData?.below_minimum);
     // ... outras verificações
     return belowMinimum || hasDisciplineMinimums || hasBlockMinimums || ...;
   };
   ```
   - ⚠️ **PROBLEMA**: Confia no flag `belowMinimum` do backend, que está incorreto
   - **Impacto**: Não elimina usuários porque flag está errado
   - **Nota**: Não verifica mínimo global atual, apenas flag salvo

2. **Linha 522**:
   ```typescript
   reservationType: normalizeReservationType(userData?.reservation_type || rankingData?.reservation_type || 'Ampla Concorrência'),
   ```
   - ✅ **CORRETO**: Normaliza antes de usar (apenas para exibição)

#### Frontend (`RankingTable.tsx`)
1. **Linha 81-120** (`isBelowMinimum`):
   ```typescript
   const isBelowMinimum = (ranking: Ranking): boolean => {
     const reservationType = ranking.reservationType || 'Ampla Concorrência';
     // ... extrai mínimos do concurso
     const isCotas = reservationType !== 'Ampla Concorrência';
     const applicableMinimum = isCotas ? minimumTotalScoreCotas : minimumTotalScore;
     const belowGlobalMinimum = applicableMinimum > 0 && score < applicableMinimum;
     return !!ranking.belowMinimum || belowGlobalMinimum || ...;
   };
   ```
   - ✅ **CORRETO**: Tem fallback que verifica mínimo global atual
   - ⚠️ **PROBLEMA**: Usa `score` (total) em vez de `objectiveScore` (sem subjetivas)
   - **Impacto**: Pode eliminar incorretamente se houver subjetivas altas
   - **Nota**: `reservationType` já vem normalizado de `rankingService.ts`

### 3. Fluxo de Dados

```
1. Usuário salva ranking
   └─> reservation_type salvo como "AC" no banco (user_rankings.consolidated_data)

2. Backend calcula score (calculate_user_score_realtime)
   └─> Lê reservation_type = "AC"
   └─> ❌ NÃO normaliza
   └─> v_is_quota = true (ERRADO!)
   └─> Busca minimum_total_score_cotas = 0
   └─> v_has_global_minimum = false (0 não é > 0)
   └─> ❌ NÃO elimina usuário

3. Frontend busca rankings (rankingService.ts)
   └─> ✅ Normaliza "AC" → "Ampla Concorrência"
   └─> Exibe corretamente no frontend

4. Frontend verifica eliminação (RankingTable.tsx)
   └─> Usa reservationType normalizado
   └─> ✅ Verifica mínimo correto
   └─> ⚠️ MAS o flag below_minimum no banco está FALSE
   └─> ⚠️ Então pode não eliminar corretamente
```

## 🔍 Problemas Identificados

### Problema 1: Backend PostgreSQL não normaliza `reservation_type`
- **Localização**: `supabase/migrations/20250127000015_fix_discipline_weights_calculation.sql` (linha 181-182)
- **Causa**: Verifica diretamente `v_quota_type != 'Ampla Concorrência'` sem normalizar
- **Impacto**: 
  - Usuários com `"AC"` são tratados como cota
  - Busca `minimum_total_score_cotas` (0) em vez de `minimum_total_score` (99)
  - Não elimina usuários abaixo do mínimo
- **Severidade**: 🔴 CRÍTICO

### Problema 2: Edge Function não normaliza `reservationType`
- **Localização**: `supabase/functions/calculate-ranking-score/index.ts` (linha 201)
- **Causa**: Verifica diretamente `reservationType !== 'Ampla Concorrência'` sem normalizar
- **Impacto**: Mesmo problema do backend PostgreSQL
- **Severidade**: 🔴 CRÍTICO

### Problema 3: Inconsistência entre Backend e Frontend
- **Backend**: Não normaliza → calcula errado → salva `below_minimum = false`
- **Frontend**: 
  - `rankingService.ts` (linha 278-298): Verifica `belowMinimum` flag do backend (confia no backend)
  - `RankingTable.tsx` (linha 81-120): Verifica flag E também verifica mínimo atual do concurso (fallback)
- **Impacto**: 
  - Backend salva flag errado → Frontend confia no flag → Não elimina
  - `RankingTable.tsx` tem fallback que verifica mínimo atual, mas pode não ser suficiente
- **Severidade**: 🟡 MÉDIO

### Problema 4: Múltiplos pontos de verificação
- Backend PostgreSQL verifica e salva flag
- Edge Function verifica e salva flag
- Frontend verifica novamente (fallback)
- **Impacto**: Lógica duplicada, difícil manter consistência
- **Severidade**: 🟡 MÉDIO

### Problema 5: Frontend verifica score total em vez de objetivo
- **Localização**: `RankingTable.tsx` linha 97
- **Causa**: `const belowGlobalMinimum = applicableMinimum > 0 && score < applicableMinimum;`
- **Impacto**: Usa `score` (total com subjetivas) em vez de `objectiveScore` (sem subjetivas)
- **Regra de Negócio**: Mínimo global deve ser verificado apenas contra score objetivo
- **Severidade**: 🟡 MÉDIO

## ✅ Solução Proposta

### Estratégia: Normalização Centralizada

#### 1. Criar Função Auxiliar no PostgreSQL
- ✅ **JÁ CRIADA**: `normalize_reservation_type(text)` 
- Localização: Migration `20251202000010_fix_reservation_type_normalization.sql`
- Status: ✅ Criada e testada

#### 2. Atualizar Backend PostgreSQL
- **Arquivo**: `supabase/migrations/20250127000015_fix_discipline_weights_calculation.sql`
- **Linha 181-182**: Substituir por:
  ```sql
  v_quota_type := normalize_reservation_type(v_user_ranking_data->'user_data'->>'reservation_type');
  v_is_quota := (v_quota_type IS NOT NULL AND v_quota_type != 'Ampla Concorrência');
  ```
- **Status**: ⚠️ Migration criada mas não aplicada corretamente

#### 3. Atualizar Edge Function
- **Arquivo**: `supabase/functions/calculate-ranking-score/index.ts`
- **Linha 201**: Adicionar normalização antes de verificar:
  ```typescript
  // Importar ou criar função de normalização
  const normalizedReservationType = normalizeReservationType(reservationType);
  const isCotas = normalizedReservationType !== 'Ampla Concorrência';
  ```
- **Status**: ❌ Não implementado

#### 4. Manter Normalização no Frontend
- **Arquivo**: `src/services/rankingService.ts`
- **Status**: ✅ Já está correto (linha 522)

#### 5. Garantir Consistência no Frontend
- **Arquivo**: `src/components/resultados/RankingTable.tsx`
- **Linha 95**: Já usa `reservationType` normalizado de `rankingService.ts` ✅
- **Linha 97**: ⚠️ CORRIGIR para usar `objectiveScore` em vez de `score`:
  ```typescript
  // Calcular score objetivo (sem subjetivas)
  const subjectiveTotal = 
    (ranking.discursiveScore || 0) +
    (ranking.caseStudy1Score || 0) +
    (ranking.caseStudy2Score || 0) +
    (ranking.caseStudy3Score || 0) +
    (ranking.otherSubjectiveScore || 0);
  const objectiveScore = score - subjectiveTotal;
  const belowGlobalMinimum = applicableMinimum > 0 && objectiveScore < applicableMinimum;
  ```
- **Status**: ⚠️ Precisa correção

## 📊 Pontos de Atenção

### 1. Dados Antigos no Banco
- Usuários com `reservation_type = "AC"` já salvos
- **Solução**: Recalcular scores após aplicar correção
- **Comando**: Chamar `recalculateUserScore()` para cada usuário afetado

### 2. Múltiplas Fontes de Verdade
- Backend PostgreSQL calcula e salva flag
- Edge Function também pode calcular
- Frontend verifica como fallback
- **Risco**: Inconsistências entre fontes
- **Recomendação**: Backend é a fonte única de verdade, frontend apenas exibe

### 3. Cache no Frontend
- `rankingService.ts` usa cache
- **Risco**: Cache pode ter dados antigos
- **Solução**: Invalidar cache após recálculo

## 🎯 Plano de Correção (Sem Executar)

### Fase 1: Backend PostgreSQL
1. ✅ Criar função `normalize_reservation_type()` (JÁ FEITO)
2. ⚠️ Atualizar `calculate_user_score_realtime` para usar função (MIGRATION CRIADA, MAS NÃO APLICADA)
3. ⚠️ Verificar se migration foi aplicada corretamente
4. ⚠️ Testar com usuário real

### Fase 2: Edge Function
1. ❌ Criar função `normalizeReservationType()` no TypeScript (Deno)
2. ❌ Atualizar `calculate-ranking-score/index.ts` para usar função
3. ❌ Testar Edge Function

### Fase 3: Frontend
1. ✅ Verificar normalização em `rankingService.ts` (JÁ CORRETO)
2. ⚠️ Melhorar normalização em `RankingTable.tsx` (garantir uso)
3. ✅ Manter fallback de verificação (já existe)

### Fase 4: Recalcular Dados
1. ⚠️ Identificar usuários afetados (reservation_type = "AC")
2. ⚠️ Recalcular scores usando função corrigida
3. ⚠️ Invalidar cache do frontend

## 🔒 Garantias de Não Regressão

### Funcionalidades que DEVEM continuar funcionando:
1. ✅ Cálculo de scores com pesos de disciplinas
2. ✅ Verificação de mínimos por disciplina
3. ✅ Verificação de mínimos por bloco
4. ✅ Verificação de mínimos subjetivos
5. ✅ Separação de classificados e eliminados
6. ✅ Cálculo de posições com empates
7. ✅ Filtros por tipo de reserva (cota)
8. ✅ Paginação de rankings
9. ✅ Cache de rankings

### Testes Necessários:
1. ✅ Usuário com `reservation_type = "Ampla Concorrência"` → Deve funcionar
2. ⚠️ Usuário com `reservation_type = "AC"` → Deve ser normalizado e funcionar
3. ⚠️ Usuário com `reservation_type = "PPP"` → Deve funcionar como cota
4. ⚠️ Usuário abaixo do mínimo global → Deve ser eliminado
5. ⚠️ Usuário acima do mínimo global → Deve ser classificado
6. ⚠️ Edição de mínimos → Deve recalcular corretamente

## 📝 Conclusão

O problema está identificado e a solução está clara:

### Problemas Críticos (🔴)
1. **Backend PostgreSQL**: Não normaliza `reservation_type` → Usuários com "AC" são tratados como cota → Não elimina
2. **Edge Function**: Não normaliza `reservationType` → Mesmo problema do backend

### Problemas Médios (🟡)
3. **Frontend `RankingTable.tsx`**: Verifica mínimo global usando `score` (total) em vez de `objectiveScore` (sem subjetivas)
4. **Frontend `rankingService.ts`**: Confia apenas no flag do backend, que está incorreto

### Solução Proposta
1. ✅ **Backend PostgreSQL**: Aplicar migration que usa `normalize_reservation_type()` (JÁ CRIADA, PRECISA SER APLICADA)
2. ❌ **Edge Function**: Adicionar normalização antes de verificar `isCotas`
3. ⚠️ **Frontend `RankingTable.tsx`**: Corrigir para usar `objectiveScore` na verificação de mínimo global
4. ⚠️ **Frontend `rankingService.ts`**: Adicionar verificação de mínimo global atual como fallback (similar ao RankingTable)

### Garantias de Não Regressão
A correção é cirúrgica e não deve afetar outras funcionalidades, desde que:
- A normalização seja aplicada apenas na verificação de cota (`isCotas` / `v_is_quota`)
- Os cálculos de score permaneçam inalterados
- A lógica de mínimos permaneça inalterada (apenas a seleção de qual mínimo usar)
- A verificação de mínimo global use sempre `objectiveScore` (sem subjetivas)

### Ordem de Execução Recomendada
1. **Fase 1**: Corrigir Backend PostgreSQL (aplicar migration)
2. **Fase 2**: Corrigir Edge Function
3. **Fase 3**: Corrigir Frontend (usar objectiveScore)
4. **Fase 4**: Recalcular scores dos usuários afetados
5. **Fase 5**: Invalidar cache e testar

