# Módulo Coach

Modularização do fluxo **coach → aluno**: assinatura, convites, dashboard, gestão de equipe e wrappers sobre Study (`coachMode` + `targetStudentId`).

## Estado atual (pós C9)

| Camada | Situação |
|--------|----------|
| **Pages** | 9 pages em `src/modules/coach/pages/` |
| **Domain** | `types`, `studentPerformance`, `invitationRules`, `coachPlanLimits` |
| **Services** | `access`, `relationships`, `subscriptions`, `tasks`, `invitation`, `studentList` |
| **Hooks** | 8 hooks (+ `useCoachStudentGate`) |
| **Components** | `layout/`, `dashboard/`, `invitations/` |
| **index.ts** | API pública completa |

**Status:** **Fechado** — C1–C9 concluídas. Tag alvo: `restore/refactor-coach-modular-complete`.

## API pública (`@/modules/coach`)

### Domain
- Tipos, `calculateStudentPerformance`, `canRespondToInvitation`, `isCoachSubscriptionActive`, limites de plano

### Services
- `coachAccessService`, `coachRelationshipService`, `coachSubscriptionService`, `coachTaskService`
- `coachInvitationService`, `fetchCoachStudentsWithDetails`, `fetchCoachStudentDetails`

### Hooks
- `useCoachSubscription`, `useCoachStudents`, `useCoachInvitations`, `useCoachInviteUserSearch`, `useSendCoachInvitation`
- `useCoachStudentDetails`, `useCoachStudentGate`, `useIsActiveCoach`, `useCoachBroadcastMessage`

### Components
- `CoachPageShell`, `CoachStudyPageWrapper`, `StudentCard`, `TeamStatsStrip`, `PendingInvitationsCard`, `BroadcastMessageDialog`, `CoachInvitationModal`

### Cross-module
- `useIsActiveCoach` + `isActiveCoachSubscription` — consumidos por `Menu`, `Planos`, `usePlanLimits`, `useGroupMembers`, `useStudyProAccess`, `useStudyCyclesV2`

## Pages

| Page | Rota | Papel |
|------|------|-------|
| `CoachLandingPage` | `/coach`, `/coach/landing` | Landing / onboarding |
| `CoachDashboard` | `/coach/dashboard` | Lista alunos, stats, broadcast, grupos |
| `InviteStudentPage` | `/coach/invite` | Convite por nickname |
| `CoachSubscriptionPage` | `/coach/subscription` | Planos e limites |
| `AcceptInvitationPage` | `/coach/invitations/:id` | Aluno aceita convite |
| `StudentDetailsPage` | `/coach/student/:studentId` | Detalhe do aluno + links Study |
| `CreateCycleForStudent` | `…/create-cycle` | Wrapper → `CriarCiclo` (coachMode) |
| `StudentCycleDisciplinesPage` | `…/disciplinas` | Wrapper → `CicloDetalhes` |
| `StudentSchedulePage` | `…/schedule` | Wrapper → `Cronograma` |

Wrappers Study delegam para `@/modules/study` — **não duplicar** lógica de ciclos/cronograma.

## Fora do módulo (permanece)

| Peça | Caminho | Notas |
|------|---------|-------|
| Tipos legacy | `src/types/coach.ts` | Re-export `@deprecated` |
| Integração Supabase | `integrations/supabase/coach/` | Implementação interna; re-exports deprecated |
| Grupos no dashboard | `components/studyGroups/CoachGroupsTab.tsx` | Depende de community/studyGroups |
| Segurança URL | `UserUrlObfuscationService` | Transversal |
| Persistência Study | `userStudyService` | Coach **consome** Study, não duplica |
| Checkout Stripe | `pages/Planos.tsx` | Usa `useIsActiveCoach` do módulo |

## Arquitetura

```
src/modules/coach/
  index.ts
  domain/
  services/
  hooks/
  components/
    layout/
    dashboard/
    invitations/
  pages/
```

## Testes

```powershell
npm run test:coach
```

30 testes em `src/tests/coach/` (domain, services, `useIsActiveCoach`).

## Referências

- [ROADMAP.md](./ROADMAP.md)
- [RESTORE.md](./RESTORE.md)
- [../study/MODULE.md](../study/MODULE.md)
