# Roadmap — modularização Statistics (ST1–ST9)

Tag final: `restore/refactor-statistics-modular-complete`

---

## Resumo das fases

| Fase | Escopo | Status |
|------|--------|--------|
| ST1 | Domínio + tipos + formatters | ✅ |
| ST2 | Services (`statisticsService`) | ✅ |
| ST3 | Hook `useStudyStatistics` | ✅ |
| ST4 | Charts | ✅ |
| ST5 | Subcomponentes (cards, painel questões) | ✅ |
| ST6 | `StatisticsPage` + `StatisticsDashboard` | ✅ |
| ST7 | Cross-module (Profile, Coach, StudyDashboard) | ✅ |
| ST8 | API pública; study re-exports deprecated | ✅ |
| ST9 | Testes, docs, matriz | ✅ |

---

## Próximo passo

Todos os módulos principais fechados (6/6, incluindo payments). Manutenção: remover re-exports `@deprecated` em release futuro.
