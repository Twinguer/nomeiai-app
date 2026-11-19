# Histórico de Correções de Bugs

Este documento consolida todas as correções de bugs e problemas identificados e resolvidos no sistema.

---

## 📊 Correções do Sistema de Rankings

### 1. Duplicação de Pontuação Subjetiva

**Problema:** O sistema estava duplicando pontuações subjetivas, causando discrepâncias (ex: 45 pontos totais vs 25 pontos visíveis).

**Causa Raiz:** A linha 449 estava somando as pontuações subjetivas duas vezes - uma no loop de questões objetivas e outra na linha 449.

**Solução:**
- Removida a duplicação na linha 449
- Adicionada validação automática para detectar discrepâncias
- Estrutura de dados corrigida para usar apenas pontuações weighted

**Arquivos Modificados:**
- `src/integrations/supabase/rankings/rankingMutations.ts`

**Scripts de Teste:**
- `scripts/test-score-fix.js`
- `scripts/fix-all-scores.js`

---

### 2. Pontuação Total Sem Peso de Disciplina

**Problema:** O `totalScore` não incluía o peso da disciplina, causando discrepâncias entre `totalScore` e `expectedTotal`.

**Causa Raiz:** Na função `scoreObjectiveAnswer`, o `totalDelta` estava retornando apenas `questionWeight` sem multiplicar pelo `disciplineWeight`.

**Solução:**
- Corrigido `totalDelta` para incluir `questionWeight * disciplineWeight`
- Garantida consistência entre `totalScore` e `objectiveWeightedTotal + subjectiveTotal`

**Arquivos Modificados:**
- `src/services/scoring.ts`

---

### 3. Subjetivas Não Incluídas no Total Score

**Problema:** Quando uma nova subjetiva era adicionada, ela aparecia na lista mas não era incluída no cálculo do `totalScore`.

**Causa Raiz:** A linha que adicionava subjetivas ao total estava comentada.

**Solução:**
- Restaurada a soma de pontuações subjetivas ao total (sem duplicação)
- Melhorados os logs para mostrar objetivo + subjetivo + total
- Criado script de teste específico para subjetivas

**Arquivos Modificados:**
- `src/integrations/supabase/rankings/rankingMutations.ts`

**Scripts de Teste:**
- `scripts/test-subjective-calculation.js`

---

### 4. Erro de Ordem de Declaração de Variáveis

**Problema:** Erro `ReferenceError: Cannot access 'objectiveWeightedTotal' before initialization` impedia o cálculo correto.

**Causa Raiz:** A variável `objectiveWeightedTotal` estava sendo usada nos logs antes de ser declarada.

**Solução:**
- Reordenadas as declarações para calcular totais objetivos antes de usar nos logs
- Garantida ordem correta de execução: calcular objetivas → calcular subjetivas → somar → calcular totais → exibir logs

**Arquivos Modificados:**
- `src/integrations/supabase/rankings/rankingMutations.ts`

**Scripts de Teste:**
- `scripts/test-ricardo-fix.js`

---

### 5. Migração para Estrutura JSONB

**Problema:** Sistema usava colunas individuais para cotas e disciplinas subjetivas, causando complexidade e inconsistências.

**Solução:**
- Criada coluna `has_cota` (JSONB) para configuração de cotas
- Criada coluna `subjects` (JSONB) para disciplinas subjetivas
- Removidas colunas antigas através de migrações
- Atualizados todos os componentes para usar nova estrutura

**Estrutura JSONB:**
```json
// has_cota
{
  "ppp": boolean,
  "pcd": boolean,
  "ind": boolean,
  "hip": boolean,
  "tra": boolean,
  "min_cota": number
}

// subjects
{
  "discr": boolean,
  "case1": boolean,
  "case2": boolean,
  "case3": boolean,
  "other": boolean
}
```

---

### 6. Campos Básicos do Concurso Não Salvavam

**Problema:** Os campos `vagas`, `inscritos`, `etapa_atual` e `link` não estavam sendo salvos no banco de dados.

**Solução:**
- Adicionados campos no `dataToSubmit` inicial em `useSaveRanking.ts`
- Incluídos campos no `formData` do `CriarRanking.tsx`
- Mapeamento correto no `concursoService.ts`

**Arquivos Modificados:**
- `src/hooks/useSaveRanking.ts`
- `src/pages/CriarRanking.tsx`
- `src/services/concursoService.ts`

---

### 7. Layout Responsivo - Grid de Cards

**Problema:** Cards da comunidade com tamanhos diferentes e alinhamento inconsistente.

**Solução:**
- Adicionado `h-full flex flex-col` aos cards
- Adicionado `flex-1` ao CardContent
- Adicionado `items-stretch` ao grid
- Reservado espaço para badge do modo coach

**Arquivos Modificados:**
- `src/components/community/UserCard.tsx`
- `src/components/community/UserGrid.tsx`

---

### 8. Posição na Ampla Concorrência ao Filtrar por Cota

**Problema:** Ao clicar na aba de uma cota, a classificação em ampla concorrência sempre aparecia como 1 (primeiro lugar).

**Causa Raiz:** O `rankingsWithQuotaPositions` estava reordenando os rankings por score, quebrando a correspondência entre `position` (do backend) e a ordem exibida.

**Solução:**
- Removida a reordenação de `classifiedRankings` por score
- Preservado o `ranking.position` original do backend
- `quotaPosition` calculado apenas para o grupo filtrado

**Arquivos Modificados:**
- `src/components/resultados/RankingTable.tsx`

---

## 🔧 Ferramentas de Correção

### Scripts Disponíveis

1. **test-score-fix.js** - Testa correção de pontuações para um usuário/concurso
2. **fix-all-scores.js** - Aplica correção em todos os rankings
3. **test-subjective-calculation.js** - Testa se subjetivas estão sendo incluídas
4. **test-ricardo-fix.js** - Testa correção específica de ordem de variáveis
5. **recalculate-scores.js** - Recalcula pontuações de um ranking

### Interface de Administração

- Componente `ScoreFix` no dashboard de administração
- Botões para testar e corrigir rankings
- Validação automática de discrepâncias

---

## 📝 Notas Importantes

- Sempre fazer backup antes de aplicar correções
- Testar primeiro em ambiente de desenvolvimento
- Usar scripts de teste antes de aplicar correções
- Monitorar logs durante execução
- Validar resultados após correções

---

**Última atualização:** Janeiro 2025

