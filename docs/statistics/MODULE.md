# Módulo Statistics

Modularização das **estatísticas de estudo**: filtros por período, merge de sessões, gráficos e página `/estatisticas`.

## Estado atual (pós ST9)

| Camada | Situação |
|--------|----------|
| **Pages** | `StatisticsPage` |
| **Domain** | `statisticsFilters`, `statisticsMerge`, `statisticsFormatters`, `types` |
| **Services** | `statisticsService` (facade `userStudyService`) |
| **Hooks** | `useStudyStatistics` |
| **Components** | charts + dashboard (summary, header, painel questões) |
| **index.ts** | API pública completa |

**Status:** **Fechado** — ST1–ST9 concluídas. Tag: `restore/refactor-statistics-modular-complete`.

## Fronteira com Study

- `userStudyService` e `calculateStudyStatistics` permanecem compartilhados
- `disciplineStudyStats` permanece em study (ciclos/cronograma)
- `@/modules/study` re-exporta statistics `@deprecated` para compatibilidade

## API pública (`@/modules/statistics`)

- **Domain:** `getStatisticsForPeriod`, `resolveUserStudyStatisticsFromData`, formatters
- **Hook:** `useStudyStatistics`
- **Components:** charts, `StatisticsDashboard`, `StatsSummaryCards`, …
- **Page:** `StatisticsPage`

## Testes

```powershell
npm run test:statistics
npm run test:study   # merge tests usam @/modules/statistics
```

## Referências

- [ROADMAP.md](./ROADMAP.md)
- [RESTORE.md](./RESTORE.md)
