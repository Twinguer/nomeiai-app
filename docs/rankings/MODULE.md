# Módulo Rankings

Estrutura modular para listagem, classificação, participação e gabaritos.

## Camadas

```
src/modules/rankings/
  domain/
    rankingAccess.ts       # Visibilidade da tabela (Pro / Free / vitrine / participante)
    rankingNavigation.ts   # URLs seguras + fluxo da listagem
    rankingProfilePosition.ts  # Posição no perfil (= mesma fonte da tabela)
    rankingRefresh.ts      # Recálculo em lote + refetch da classificação
    answerKeyValidation.ts # Completude do gabarito oficial por caderno
    rankingFormMappers.ts  # Mapeamento form → JSONB (cotas, subjetivas)
  hooks/
    useResultadosData.ts   # Dados da página de classificação
    useClassificationAccess.ts
    useSaveRanking.ts      # Persistência na criação/edição
    useSaveAnswers/        # Save de respostas (RPC)
    useLeaveRanking.ts
  services/
    rankingService.ts         # leitura RPC + ordenação/desempate
    rankingCache.ts
    rankingFormatting.ts
  components/
    classification/          # tabela, cards, toolbar, loading
    participation/             # ParticipationForm, AnswerSheet, selectors
  pages/
    RankingsPage.tsx       # /pre-classificacao
    ResultadosPage.tsx     # classificação (/concurso/ranking/:token)
    CriarRankingPage.tsx   # /criar-ranking
    CargosPage.tsx         # /pre-classificacao/:token/cargos
    ConcursoParticipationPage.tsx  # /concurso/participar/:token
  index.ts                 # API pública do módulo
```

**Fora do módulo (compartilhado):**

| Área | Caminho |
|------|---------|
| Supabase | `integrations/supabase/rankings/` |
| Segurança transversal | `SecureConcursoRoute`, `UrlObfuscationService` |
| Perfil | `UserProfile`, `RankingsTab` — consomem `@/modules/rankings` |

## Invariantes (não quebrar)

1. **Posição e eliminação** vêm de `fetchUserRankings` / backend — não recalcular no frontend.
2. **Scores e gabaritos** via RPC (`recalculate_all_scores_with_weights`, `save_user_answers…`).
3. **Rotas** só com token: `/concurso/ranking/:token` (nunca `/ranking/:uuid`).
4. **Suspense** fora de `SecureConcursoRoute` ( `App.tsx` ).
5. **Visibilidade** centralizada em `canViewClassification` ( `rankingAccess.ts` ).
6. **Navegação** centralizada em `rankingNavigation.ts` — UI não monta URL legada.

## Regras de visibilidade da classificação

| Usuário | Vitrine | Pode ver tabela |
|---------|---------|-----------------|
| Anônimo | qualquer | Sim |
| Pro | qualquer | Sim |
| Free criador | — | Sim |
| Free participante | — | Sim |
| Free não participante | Sim | Sim |
| Free não participante | Não | Não (CTA participar / Pro) |

## Fluxo principal

1. `/pre-classificacao` → `openRankingFromList`
2. Card geral → `/pre-classificacao/:token/cargos`
3. Cargo → `/concurso/ranking/:token`
4. `SecureConcursoRoute` → `ResultadosPage` + `useResultadosData`
5. Refresh → `refreshClassificationData` (recálculo em lote via RPC)

## Import recomendado

```ts
import {
  canViewClassification,
  openRankingFromList,
  fetchUserRankings,
  rankingCache,
  getProfileRankingStatus,
} from '@/modules/rankings';
```

## Status (R9 — modular completo)

- Toda a superfície de rankings vive em `src/modules/rankings/` — sem re-exports legados
- Pages roteadas via `modules/rankings/pages/` (`App.tsx`)
- Callers externos (`UserProfile`, `PublicUserProfile`, `concursoService`, rotas seguras) importam `@/modules/rankings`
- `PreClassificacao.tsx` e `components/resultados/` removidos (substituídos pelo módulo)

## Testes

```powershell
npm run test:rankings
```

## Docs relacionados

- [ROADMAP.md](./ROADMAP.md) — planejamento R5–R9 (modularização completa)
- [RESTORE.md](./RESTORE.md) — pontos de restauração Git
- [../../src/docs/RankingUpdateFlow.md](../../src/docs/RankingUpdateFlow.md) — recálculo de scores
