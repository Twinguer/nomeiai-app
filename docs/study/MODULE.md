# Módulo Study

Estrutura modular para ciclos, cronograma, timer e estatísticas de estudo (`user_study_v2`).

## Camadas

```
src/modules/study/
  domain/
    scheduleHelpers.ts
    scheduleMode.ts
    studyStatisticsMerge.ts
    studyStatisticsFilters.ts
    disciplineStudyStats.ts
    studyCycleSchedule.ts
    studyWrite.ts
  services/
    studySessionService.ts
  hooks/
    useCronogramaData.ts
    useStudyStatistics.ts
    useStudyCyclesV2.tsx
    useStudyProAccess.ts
    useSecureStudyCycleUrls.ts
    useCycleDocuments.ts
  components/
    EditalVerticalizado.tsx, SortableBlocksList.tsx, …
  pages/
    StudyDashboard.tsx      # /estudos
    Cronograma.tsx          # cronograma (+ coachMode)
    Timer.tsx
    CriarCiclo.tsx, EditarCiclo.tsx, CicloDetalhes.tsx
    SessaoEstudos.tsx       # redirect legado
  index.ts
```

**Fora do módulo:**

| Área | Caminho |
|------|---------|
| Persistência JSONB | `services/userStudyService.ts` |
| Segurança | `SecureStudyCycleRoute`, `studyCycleUrlObfuscation` |
| Coach | `modules/coach/` — wrappers com `coachMode` + `targetStudentId` |
| Grupos | `components/studyGroups/` |
| Timer global | `contexts/TimerContext.tsx` |

## Invariantes

Ver [StudyDataContract.md](../../src/docs/StudyDataContract.md).

## Integração Coach

Wrappers em `modules/coach/pages/` renderizam pages do study com `coachMode` e `targetStudentId`. Gate: `useCoachStudentGate` + RPC + RLS.

## Import

```ts
import {
  getScheduleSessions,
  useCronogramaData,
  CronogramaPage,
  type CronogramaProps,
} from '@/modules/study';
```

## Status (S9 — modular completo)

- Tag: `restore/refactor-study-modular-complete` → `0dd1f1f1`
- Toda superfície de estudos em `src/modules/study/`
- `App.tsx` e Coach importam pages do módulo
- Callers externos (perfil, estatísticas, Pro guard) usam `@/modules/study`
- `userStudyService` permanece compartilhado (fatia futura opcional)

## Testes

```powershell
npm run test:study
```
