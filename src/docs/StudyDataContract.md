# Contrato de dados — Estudos (`user_study_v2`)

Documento de referência para refatoração sem regressão.

## Fontes de verdade

| Dado | Fonte primária | Leitura | Escrita |
|------|----------------|---------|---------|
| Tarefas do cronograma | `study_schedule[]` | `getScheduleSessions()` | `addScheduleSession`, `removeScheduleSession` |
| Histórico de estudo | `study_sessions[]` (ledger) | `resolveStudySessions()` | Save manual (`recordCompletedSession`) |
| Totais globais | Derivado do ledger | `resolveUserStudyStatisticsFromData()` | Recalculado em todo save manual |
| Totais por tarefa | `study_schedule[].total_stats` | Cronograma / coach | `recordCompletedSession` |
| Legado | `study_cycles[].schedule_data.weekly_schedule` | Fallback em `getScheduleSessions()` | **Somente leitura** (escrita com `VITE_MIRROR_WEEKLY_STATS=true`) |

## Regras de produto (não quebrar)

1. **Registro manual único** — tempo e questões só entram pelo modal da tarefa no cronograma.
2. **Timer** — ferramenta de foco; pode sugerir minutos no modal; **não persiste** estatísticas.
3. **Excluir tarefa** — remove entrada do cronograma; **não apaga** linhas em `study_sessions`.
4. **Sessões órfãs** (`schedule_session_id` sem tarefa) — histórico válido; entram nas estatísticas globais.

## Flag de transição

- `VITE_MIRROR_WEEKLY_STATS=true` — espelha `total_stats` e remoções em `weekly_schedule` (compatibilidade).
- Omitido ou `false` (**padrão**) — escrita só em `study_schedule` + ledger + stats.

## Pontos de restauração

Ver `docs/refactor-estudos/RESTORE.md`.
