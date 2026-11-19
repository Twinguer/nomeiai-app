# Resumo Executivo: Análise do Módulo de Ranking

## 🎯 Problema Principal

**Usuários com `reservation_type = "AC"` não estão sendo eliminados mesmo quando estão abaixo do mínimo global de 99 pontos.**

## 🔍 Causa Raiz

O sistema não normaliza `reservation_type` antes de verificar se o usuário concorre por cota. Quando `reservation_type = "AC"`, o sistema trata como cota e busca `minimum_total_score_cotas` (0) em vez de `minimum_total_score` (99), resultando em `v_has_global_minimum = false` e não eliminando o usuário.

## 📍 Pontos Críticos Identificados

### 1. Backend PostgreSQL (🔴 CRÍTICO)
- **Arquivo**: `supabase/migrations/20250127000015_fix_discipline_weights_calculation.sql`
- **Linha**: 181-182
- **Problema**: Não normaliza `reservation_type` antes de verificar se é cota
- **Status**: Migration criada mas não aplicada corretamente

### 2. Edge Function (🔴 CRÍTICO)
- **Arquivo**: `supabase/functions/calculate-ranking-score/index.ts`
- **Linha**: 201
- **Problema**: Não normaliza `reservationType` antes de verificar
- **Status**: Não implementado

### 3. Frontend `RankingTable.tsx` (🟡 MÉDIO)
- **Linha**: 97
- **Problema**: Usa `score` (total) em vez de `objectiveScore` (sem subjetivas) para verificar mínimo global
- **Status**: Precisa correção

### 4. Frontend `rankingService.ts` (🟡 MÉDIO)
- **Linha**: 278-298
- **Problema**: Confia apenas no flag `belowMinimum` do backend, que está incorreto
- **Status**: Precisa adicionar fallback similar ao `RankingTable.tsx`

## ✅ Solução Proposta (Sem Executar)

### Backend PostgreSQL
1. ✅ Função auxiliar `normalize_reservation_type()` já criada
2. ⚠️ Migration `20251202000011_apply_reservation_type_normalization.sql` criada mas não aplicada
3. **Ação**: Aplicar migration que atualiza `calculate_user_score_realtime` para usar `normalize_reservation_type()`

### Edge Function
1. **Ação**: Criar função `normalizeReservationType()` no TypeScript (Deno)
2. **Ação**: Atualizar linha 201 para normalizar antes de verificar `isCotas`

### Frontend
1. ✅ `rankingService.ts` já normaliza para exibição (linha 522)
2. ⚠️ `RankingTable.tsx` precisa usar `objectiveScore` em vez de `score` (linha 97)
3. ⚠️ `rankingService.ts` precisa adicionar verificação de mínimo global atual como fallback

## 🔄 Fluxo de Dados Atual (Com Problema)

```
1. Usuário salva ranking
   └─> reservation_type = "AC" salvo no banco

2. Backend calcula (calculate_user_score_realtime)
   └─> Lê "AC"
   └─> ❌ NÃO normaliza
   └─> v_is_quota = true (ERRADO!)
   └─> Busca minimum_total_score_cotas = 0
   └─> v_has_global_minimum = false
   └─> ❌ Salva below_minimum = false

3. Frontend busca (rankingService.ts)
   └─> ✅ Normaliza "AC" → "Ampla Concorrência" (apenas exibição)
   └─> Verifica flag below_minimum = false
   └─> ❌ Não elimina (confia no flag errado)

4. Frontend exibe (RankingTable.tsx)
   └─> ✅ Verifica mínimo atual (fallback)
   └─> ⚠️ MAS usa score total em vez de objetivo
   └─> Pode não eliminar corretamente
```

## 🔄 Fluxo de Dados Corrigido (Proposto)

```
1. Usuário salva ranking
   └─> reservation_type = "AC" salvo no banco

2. Backend calcula (calculate_user_score_realtime)
   └─> Lê "AC"
   └─> ✅ Normaliza usando normalize_reservation_type("AC") → "Ampla Concorrência"
   └─> v_is_quota = false (CORRETO!)
   └─> Busca minimum_total_score = 99
   └─> v_has_global_minimum = true
   └─> ✅ Verifica: objectiveScore (15) < 99 → below_minimum = true
   └─> ✅ Salva below_minimum = true

3. Frontend busca (rankingService.ts)
   └─> ✅ Normaliza "AC" → "Ampla Concorrência" (exibição)
   └─> Verifica flag below_minimum = true
   └─> ✅ Elimina corretamente

4. Frontend exibe (RankingTable.tsx)
   └─> ✅ Verifica mínimo atual (fallback)
   └─> ✅ Usa objectiveScore (sem subjetivas)
   └─> ✅ Elimina corretamente
```

## 📋 Checklist de Correções Necessárias

### Backend PostgreSQL
- [ ] Verificar se migration `20251202000011` foi aplicada
- [ ] Se não, aplicar migration que atualiza `calculate_user_score_realtime`
- [ ] Testar função com `reservation_type = "AC"`

### Edge Function
- [ ] Criar função `normalizeReservationType()` no Deno
- [ ] Atualizar linha 201 para normalizar antes de verificar
- [ ] Testar Edge Function com `reservationType = "AC"`

### Frontend
- [ ] Corrigir `RankingTable.tsx` linha 97 para usar `objectiveScore`
- [ ] Adicionar verificação de mínimo global em `rankingService.ts` como fallback
- [ ] Testar exibição de rankings

### Dados
- [ ] Identificar usuários com `reservation_type = "AC"`
- [ ] Recalcular scores usando função corrigida
- [ ] Invalidar cache do frontend

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

### Regras de Negócio que DEVEM ser respeitadas:
1. ✅ Mínimo global verificado apenas contra score objetivo (sem subjetivas)
2. ✅ Subjetivas têm mínimos separados
3. ✅ Mínimos de cotas são diferentes de mínimos de AC
4. ✅ Eliminados não recebem posição (posição = 0)
5. ✅ Classificados são ordenados por score (descendente)
6. ✅ Empates recebem a mesma posição

## 📊 Impacto Esperado

### Antes da Correção
- ❌ 3 usuários com "AC" e scores 15, 30, 45 não eliminados
- ❌ Flag `below_minimum = false` incorreto no banco
- ❌ Frontend pode não eliminar corretamente

### Depois da Correção
- ✅ Usuários com "AC" normalizados para "Ampla Concorrência"
- ✅ Flag `below_minimum = true` correto no banco
- ✅ Frontend elimina corretamente
- ✅ Todos os mínimos aplicados corretamente (AC vs Cotas)

## ⚠️ Riscos e Mitigações

### Risco 1: Dados Antigos
- **Risco**: Usuários com "AC" já calculados com flag errado
- **Mitigação**: Recalcular scores após aplicar correção

### Risco 2: Cache Desatualizado
- **Risco**: Frontend pode usar cache com dados antigos
- **Mitigação**: Invalidar cache após recálculo

### Risco 3: Múltiplas Fontes de Verdade
- **Risco**: Backend, Edge Function e Frontend podem divergir
- **Mitigação**: Backend é fonte única de verdade, frontend apenas exibe

### Risco 4: Regressão em Outras Funcionalidades
- **Risco**: Correção pode afetar outras partes do sistema
- **Mitigação**: Correção é cirúrgica, apenas na verificação de cota

## 📝 Próximos Passos (Aguardando Autorização)

1. **Aplicar migration do Backend PostgreSQL**
2. **Corrigir Edge Function**
3. **Corrigir Frontend (usar objectiveScore)**
4. **Recalcular scores dos usuários afetados**
5. **Testar todas as funcionalidades**

---

**Documento criado em**: 2025-12-04
**Status**: Análise completa, aguardando autorização para correções

